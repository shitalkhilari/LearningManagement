import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CourseModule } from '../modules/entities/course-module.entity';
import { Quiz } from '../assessments/entities/quiz.entity';
import { QuizAttempt } from '../assessments/entities/quiz-attempt.entity';
import { LessonProgress } from './entities/lesson-progress.entity';
import { calculateCompletion } from './progress.calculator';
import { ProgressReport } from './progress-report.interface';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LessonProgress)
    private readonly progressRepository: Repository<LessonProgress>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
    @InjectRepository(CourseModule)
    private readonly modulesRepository: Repository<CourseModule>,
    @InjectRepository(Quiz)
    private readonly quizzesRepository: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
  ) {}

  async markLessonCompleted(actor: AuthUser, lessonId: string): Promise<ProgressReport> {
    if (actor.role !== UserRole.LEARNER) {
      throw new ForbiddenException('Only learners can mark a lesson complete');
    }
    const lesson = await this.lessonsRepository.findOne({
      where: { id: lessonId },
      relations: { module: { course: true } },
    });
    if (!lesson || lesson.module.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Lesson not found');
    }
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { learnerId: actor.id, courseId: lesson.module.courseId },
      relations: { learner: true, course: true },
    });
    if (!enrollment) {
      throw new ForbiddenException('Enroll in the course before completing lessons');
    }

    const existing = await this.progressRepository.findOne({
      where: { enrollmentId: enrollment.id, lessonId: lesson.id },
    });
    if (!existing) {
      const created = this.progressRepository.create({
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        isCompleted: true,
        completedAt: new Date(),
      });
      await this.progressRepository.save(created);
    } else if (!existing.isCompleted) {
      existing.isCompleted = true;
      existing.completedAt = new Date();
      await this.progressRepository.save(existing);
    }

    return this.syncAndBuild(enrollment.id);
  }

  async listMine(actor: AuthUser): Promise<ProgressReport[]> {
    const enrollments = await this.enrollmentsRepository.find({
      where: { learnerId: actor.id },
      relations: { learner: true, course: true },
    });
    const reports: ProgressReport[] = [];
    for (const enrollment of enrollments) {
      reports.push(await this.syncAndBuild(enrollment.id));
    }
    return reports;
  }

  async getByEnrollment(actor: AuthUser, enrollmentId: string): Promise<ProgressReport> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id: enrollmentId },
      relations: { learner: true, course: true },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    if (actor.role === UserRole.LEARNER && enrollment.learnerId !== actor.id) {
      throw new ForbiddenException('You can only view your own progress');
    }
    if (actor.role === UserRole.INSTRUCTOR && enrollment.course.instructorId !== actor.id) {
      throw new ForbiddenException('You can only view progress for your own courses');
    }
    return this.syncAndBuild(enrollment.id);
  }

  async listForLearner(learnerId: string, courseIds?: string[]): Promise<ProgressReport[]> {
    const enrollments = await this.enrollmentsRepository.find({
      where: { learnerId },
      relations: { learner: true, course: true },
    });
    const filtered = courseIds
      ? enrollments.filter((enrollment) => courseIds.includes(enrollment.courseId))
      : enrollments;
    const reports: ProgressReport[] = [];
    for (const enrollment of filtered) {
      reports.push(await this.syncAndBuild(enrollment.id));
    }
    return reports;
  }

  async syncAndBuild(enrollmentId: string): Promise<ProgressReport> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id: enrollmentId },
      relations: { learner: true, course: true },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    const totalModules = await this.modulesRepository.count({ where: { courseId: enrollment.courseId } });
    const totalLessons = await this.lessonsRepository
      .createQueryBuilder('lesson')
      .innerJoin('lesson.module', 'module')
      .where('module.courseId = :courseId', { courseId: enrollment.courseId })
      .getCount();
    const completedRows = await this.progressRepository.find({
      where: { enrollmentId: enrollment.id, isCompleted: true },
      select: { lessonId: true },
    });
    const completedLessonIds = completedRows.map((row) => row.lessonId);
    const completedLessons = completedLessonIds.length;
    const lessonCompletion = calculateCompletion(completedLessons, totalLessons);
    const passedQuizIds = await this.passedQuizIds(enrollment.courseId, enrollment.learnerId);
    const totalQuizzes = await this.quizzesRepository.count({ where: { courseId: enrollment.courseId } });
    const passedQuizzes = Math.min(passedQuizIds.length, totalQuizzes);
    const overall = calculateCompletion(
      Math.min(completedLessons, totalLessons) + passedQuizzes,
      totalLessons + totalQuizzes,
    );
    if (enrollment.status !== overall.status) {
      enrollment.status = overall.status;
      await this.enrollmentsRepository.save(enrollment);
    }
    return {
      learner: {
        id: enrollment.learner.id,
        firstName: enrollment.learner.firstName,
        lastName: enrollment.learner.lastName,
        email: enrollment.learner.email,
      },
      course: {
        id: enrollment.course.id,
        title: enrollment.course.title,
        status: enrollment.course.status,
      },
      enrollmentId: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      totalModules,
      totalLessons,
      completedLessons: Math.min(completedLessons, totalLessons),
      pendingLessons: lessonCompletion.pendingLessons,
      completedLessonIds,
      totalQuizzes,
      passedQuizzes,
      passedQuizIds,
      completionPercentage: overall.percentage,
      enrollmentStatus: overall.status,
    };
  }

  private async passedQuizIds(courseId: string, learnerId: string): Promise<string[]> {
    const rows = await this.attemptsRepository
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .select('attempt.quizId', 'quizId')
      .distinct(true)
      .where('quiz.courseId = :courseId', { courseId })
      .andWhere('attempt.learnerId = :learnerId', { learnerId })
      .andWhere('attempt.status = :status', { status: QuizAttemptStatus.PASS })
      .getRawMany<Record<string, string>>();
    return rows.map((row) => row.quizId || row.quizid || row.quiz_id).filter((id): id is string => Boolean(id));
  }
}
