import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { CourseModule } from '../modules/entities/course-module.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizOption } from './entities/quiz-option.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizResponse } from './entities/quiz-response.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuizOptionDto } from './dto/quiz-option.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { scoreQuiz, QuizScore } from './quiz-scoring';

export interface QuizResult extends QuizScore {
  attemptId: string;
  quizId: string;
  submittedAt: Date;
  responses: Array<{
    questionId: string;
    questionText: string;
    selectedOptionId: string;
    selectedOptionText: string;
    isCorrect: boolean;
  }>;
}

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizzesRepository: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly questionsRepository: Repository<QuizQuestion>,
    @InjectRepository(QuizOption)
    private readonly optionsRepository: Repository<QuizOption>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
    @InjectRepository(QuizResponse)
    private readonly responsesRepository: Repository<QuizResponse>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(CourseModule)
    private readonly modulesRepository: Repository<CourseModule>,
    private readonly coursesService: CoursesService,
    private readonly dataSource: DataSource,
  ) {}

  async createQuiz(courseId: string, actor: AuthUser, dto: CreateQuizDto): Promise<Quiz> {
    const course = await this.coursesService.getManagedCourse(courseId, actor);
    if (dto.moduleId) {
      await this.assertModuleInCourse(dto.moduleId, course.id);
    }
    const quiz = this.quizzesRepository.create({
      courseId: course.id,
      moduleId: dto.moduleId ?? null,
      title: dto.title.trim(),
      description: dto.description.trim(),
      passingPercentage: dto.passingPercentage,
    });
    return this.quizzesRepository.save(quiz);
  }

  async listByCourse(courseId: string, actor: AuthUser): Promise<Quiz[]> {
    const course = await this.coursesService.getVisibleCourse(courseId, actor);
    await this.assertLearnerEnrolledIfNeeded(actor, course.id, course.status);
    const quizzes = await this.quizzesRepository.find({
      where: { courseId },
      relations: { questions: { options: true } },
      order: { createdAt: 'ASC' },
    });
    return quizzes.map((quiz) => this.shapeQuiz(quiz, actor));
  }

  async findOne(id: string, actor: AuthUser): Promise<Quiz> {
    const quiz = await this.loadQuiz(id);
    await this.assertCanRead(actor, quiz);
    return this.shapeQuiz(quiz, actor);
  }

  async updateQuiz(id: string, actor: AuthUser, dto: UpdateQuizDto): Promise<Quiz> {
    const quiz = await this.loadQuiz(id);
    await this.coursesService.getManagedCourse(quiz.courseId, actor);
    if (dto.title !== undefined) {
      quiz.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      quiz.description = dto.description.trim();
    }
    if (dto.passingPercentage !== undefined) {
      quiz.passingPercentage = dto.passingPercentage;
    }
    if (dto.moduleId !== undefined) {
      await this.assertModuleInCourse(dto.moduleId, quiz.courseId);
      quiz.moduleId = dto.moduleId;
    }
    await this.quizzesRepository.save(quiz);
    return this.findOne(id, actor);
  }

  async removeQuiz(id: string, actor: AuthUser): Promise<{ message: string }> {
    const quiz = await this.loadQuiz(id);
    await this.coursesService.getManagedCourse(quiz.courseId, actor);
    const attempts = await this.attemptsRepository.count({ where: { quizId: id } });
    if (attempts > 0) {
      throw new ConflictException('Cannot delete a quiz that has attempts');
    }
    await this.quizzesRepository.delete(id);
    return { message: 'Quiz deleted' };
  }

  async addQuestion(quizId: string, actor: AuthUser, dto: CreateQuestionDto): Promise<QuizQuestion> {
    const quiz = await this.loadQuiz(quizId);
    await this.coursesService.getManagedCourse(quiz.courseId, actor);
    this.assertSingleCorrectOption(dto.options);
    const sequence = dto.sequence ?? (await this.nextQuestionSequence(quizId));
    return this.dataSource.transaction(async (manager) => {
      const question = await manager.save(
        manager.create(QuizQuestion, {
          quizId,
          questionText: dto.questionText.trim(),
          sequence,
        }),
      );
      const options = dto.options.map((option) =>
        manager.create(QuizOption, {
          questionId: question.id,
          optionText: option.optionText.trim(),
          isCorrect: option.isCorrect,
        }),
      );
      question.options = await manager.save(options);
      return question;
    });
  }

  async updateQuestion(id: string, actor: AuthUser, dto: UpdateQuestionDto): Promise<QuizQuestion> {
    const question = await this.questionsRepository.findOne({
      where: { id },
      relations: { quiz: true, options: true },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    await this.coursesService.getManagedCourse(question.quiz.courseId, actor);
    if (dto.options) {
      this.assertSingleCorrectOption(dto.options);
      const responseCount = await this.responsesRepository.count({ where: { questionId: id } });
      if (responseCount > 0) {
        throw new ConflictException('Cannot change options after learners have answered this question');
      }
    }
    return this.dataSource.transaction(async (manager) => {
      if (dto.questionText !== undefined) {
        question.questionText = dto.questionText.trim();
      }
      if (dto.sequence !== undefined) {
        question.sequence = dto.sequence;
      }
      await manager.save(question);
      if (dto.options) {
        await manager.delete(QuizOption, { questionId: question.id });
        question.options = await manager.save(
          dto.options.map((option) =>
            manager.create(QuizOption, {
              questionId: question.id,
              optionText: option.optionText.trim(),
              isCorrect: option.isCorrect,
            }),
          ),
        );
      }
      return question;
    });
  }

  async removeQuestion(id: string, actor: AuthUser): Promise<{ message: string }> {
    const question = await this.questionsRepository.findOne({ where: { id }, relations: { quiz: true } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    await this.coursesService.getManagedCourse(question.quiz.courseId, actor);
    const responseCount = await this.responsesRepository.count({ where: { questionId: id } });
    if (responseCount > 0) {
      throw new ConflictException('Cannot delete a question that has responses');
    }
    await this.questionsRepository.delete(id);
    return { message: 'Question deleted' };
  }

  async submit(quizId: string, actor: AuthUser, dto: SubmitQuizDto): Promise<QuizResult> {
    if (actor.role !== UserRole.LEARNER) {
      throw new ForbiddenException('Only learners can submit a quiz');
    }
    const quiz = await this.loadQuiz(quizId);
    if (quiz.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Quiz not found');
    }
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { learnerId: actor.id, courseId: quiz.courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Enroll in the course before attempting the quiz');
    }
    const questions = [...(quiz.questions ?? [])].sort((a, b) => a.sequence - b.sequence);
    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions');
    }
    const answerMap = new Map<string, string>();
    for (const answer of dto.answers) {
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException('Each question can be answered only once');
      }
      answerMap.set(answer.questionId, answer.selectedOptionId);
    }
    if (answerMap.size !== questions.length) {
      throw new BadRequestException('All questions must be answered');
    }

    const graded: Array<{
      questionId: string;
      questionText: string;
      selectedOptionId: string;
      selectedOptionText: string;
      isCorrect: boolean;
    }> = [];
    for (const question of questions) {
      const selectedId = answerMap.get(question.id);
      if (!selectedId) {
        throw new BadRequestException('All questions must be answered');
      }
      const option = (question.options ?? []).find((item) => item.id === selectedId);
      if (!option) {
        throw new BadRequestException('Selected option does not belong to the question');
      }
      graded.push({
        questionId: question.id,
        questionText: question.questionText,
        selectedOptionId: option.id,
        selectedOptionText: option.optionText,
        isCorrect: option.isCorrect,
      });
    }

    const scored = scoreQuiz(
      graded.filter((item) => item.isCorrect).length,
      questions.length,
      quiz.passingPercentage,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const attempt = await manager.save(
        manager.create(QuizAttempt, {
          quizId: quiz.id,
          learnerId: actor.id,
          score: scored.score,
          totalQuestions: scored.totalQuestions,
          percentage: scored.percentage,
          status: scored.status,
          submittedAt: new Date(),
        }),
      );
      await manager.save(
        graded.map((item) =>
          manager.create(QuizResponse, {
            attemptId: attempt.id,
            questionId: item.questionId,
            selectedOptionId: item.selectedOptionId,
            isCorrect: item.isCorrect,
          }),
        ),
      );
      return attempt;
    });

    return {
      ...scored,
      attemptId: saved.id,
      quizId: quiz.id,
      submittedAt: saved.submittedAt,
      responses: graded,
    };
  }

  async listAttempts(quizId: string, actor: AuthUser): Promise<QuizAttempt[]> {
    const quiz = await this.loadQuiz(quizId);
    await this.assertCanRead(actor, quiz);
    const where =
      actor.role === UserRole.LEARNER ? { quizId, learnerId: actor.id } : { quizId };
    return this.attemptsRepository.find({
      where,
      relations: { learner: true },
      order: { submittedAt: 'DESC' },
    });
  }

  async findAttempt(id: string, actor: AuthUser): Promise<QuizAttempt> {
    const attempt = await this.attemptsRepository.findOne({
      where: { id },
      relations: {
        learner: true,
        quiz: { course: true },
        responses: { question: true, selectedOption: true },
      },
    });
    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found');
    }
    if (actor.role === UserRole.LEARNER && attempt.learnerId !== actor.id) {
      throw new ForbiddenException('You can only view your own quiz attempts');
    }
    if (actor.role === UserRole.INSTRUCTOR && attempt.quiz.course.instructorId !== actor.id) {
      throw new ForbiddenException('You can only view attempts for your own courses');
    }
    return attempt;
  }

  private async loadQuiz(id: string): Promise<Quiz> {
    const quiz = await this.quizzesRepository.findOne({
      where: { id },
      relations: { course: true, questions: { options: true } },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    quiz.questions = (quiz.questions ?? []).sort((a, b) => a.sequence - b.sequence);
    return quiz;
  }

  private async assertCanRead(actor: AuthUser, quiz: Quiz): Promise<void> {
    const course = await this.coursesService.getVisibleCourse(quiz.courseId, actor);
    await this.assertLearnerEnrolledIfNeeded(actor, course.id, course.status);
  }

  private async assertLearnerEnrolledIfNeeded(
    actor: AuthUser,
    courseId: string,
    status: CourseStatus,
  ): Promise<void> {
    if (actor.role !== UserRole.LEARNER) {
      return;
    }
    if (status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Quiz not found');
    }
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { learnerId: actor.id, courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Enroll in the course before viewing its quizzes');
    }
  }

  private async assertModuleInCourse(moduleId: string, courseId: string): Promise<void> {
    const module = await this.modulesRepository.findOne({ where: { id: moduleId } });
    if (!module || module.courseId !== courseId) {
      throw new BadRequestException('moduleId must belong to the same course');
    }
  }

  private assertSingleCorrectOption(options: QuizOptionDto[]): void {
    const correct = options.filter((option) => option.isCorrect).length;
    if (correct !== 1) {
      throw new BadRequestException('Each question must have exactly one correct option');
    }
  }

  private async nextQuestionSequence(quizId: string): Promise<number> {
    const row = await this.questionsRepository
      .createQueryBuilder('question')
      .select('COALESCE(MAX(question.sequence), 0)', 'max')
      .where('question.quizId = :quizId', { quizId })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  private shapeQuiz(quiz: Quiz, actor: AuthUser): Quiz {
    if (actor.role !== UserRole.LEARNER) {
      return quiz;
    }
    const questions = (quiz.questions ?? []).map((question) => ({
      ...question,
      options: (question.options ?? []).map((option) => ({
        id: option.id,
        questionId: option.questionId,
        optionText: option.optionText,
      })),
    }));
    return { ...quiz, questions } as Quiz;
  }
}
