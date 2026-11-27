import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { AssessmentsService } from './assessments.service';

const learner: AuthUser = {
  id: 'learner-1',
  email: 'learner1@lms.local',
  firstName: 'Noah',
  lastName: 'Patel',
  role: UserRole.LEARNER,
  isActive: true,
};

describe('AssessmentsService', () => {
  const quizzesRepository = { findOne: jest.fn() };
  const questionsRepository = {};
  const optionsRepository = {};
  const attemptsRepository = {};
  const responsesRepository = {};
  const enrollmentsRepository = { findOne: jest.fn() };
  const modulesRepository = {};
  const coursesService = { getVisibleCourse: jest.fn(), getManagedCourse: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        create: (_entity: unknown, value: unknown) => value,
        delete: jest.fn(),
        save: jest.fn(async (value: unknown) => {
          if (Array.isArray(value)) {
            return value;
          }
          return { id: 'attempt-1', submittedAt: new Date('2026-02-01'), ...(value as object) };
        }),
      };
      return work(manager);
    }),
  };

  const service = new AssessmentsService(
    quizzesRepository as never,
    questionsRepository as never,
    optionsRepository as never,
    attemptsRepository as never,
    responsesRepository as never,
    enrollmentsRepository as never,
    modulesRepository as never,
    coursesService as unknown as CoursesService,
    dataSource as never,
  );

  const quiz = {
    id: 'quiz-1',
    courseId: 'course-1',
    passingPercentage: 50,
    course: { id: 'course-1', status: CourseStatus.PUBLISHED, instructorId: 'inst-1' },
    questions: [
      {
        id: 'q1',
        questionText: 'Where do rules live?',
        sequence: 1,
        options: [
          { id: 'o1', optionText: 'Service', isCorrect: true },
          { id: 'o2', optionText: 'Browser', isCorrect: false },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    quizzesRepository.findOne.mockResolvedValue(quiz);
    enrollmentsRepository.findOne.mockResolvedValue({ id: 'enr-1' });
  });

  it('rejects an answer for a question that is not on the quiz', async () => {
    await expect(
      service.submit('quiz-1', learner, {
        answers: [{ questionId: 'other', selectedOptionId: 'o1' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an option that does not belong to the question', async () => {
    await expect(
      service.submit('quiz-1', learner, {
        answers: [{ questionId: 'q1', selectedOptionId: 'missing' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scores a correct submission on the server and stores the attempt', async () => {
    const result = await service.submit('quiz-1', learner, {
      answers: [{ questionId: 'q1', selectedOptionId: 'o1' }],
    });
    expect(result.score).toBe(1);
    expect(result.percentage).toBe(100);
    expect(result.status).toBe(QuizAttemptStatus.PASS);
    expect(result.attemptId).toBe('attempt-1');
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('scores an incorrect submission as a fail when it is below the pass mark', async () => {
    quizzesRepository.findOne.mockResolvedValue({ ...quiz, passingPercentage: 100 });
    const result = await service.submit('quiz-1', learner, {
      answers: [{ questionId: 'q1', selectedOptionId: 'o2' }],
    });
    expect(result.correctAnswers).toBe(0);
    expect(result.incorrectAnswers).toBe(1);
    expect(result.status).toBe(QuizAttemptStatus.FAIL);
  });

  it('blocks a learner who is not enrolled', async () => {
    enrollmentsRepository.findOne.mockResolvedValue(null);
    await expect(
      service.submit('quiz-1', learner, { answers: [{ questionId: 'q1', selectedOptionId: 'o1' }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides the correct option from a learner quiz view', async () => {
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    const view = await service.findOne('quiz-1', learner);
    const option = view.questions[0].options[0] as { isCorrect?: boolean };
    expect(option.isCorrect).toBeUndefined();
  });

  it('creates, updates, and refuses to delete a quiz that has attempts', async () => {
    const instructor = { ...learner, role: UserRole.INSTRUCTOR };
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    const quizzes = quizzesRepository as unknown as {
      create: jest.Mock;
      save: jest.Mock;
      delete: jest.Mock;
    };
    quizzes.create = jest.fn((value) => value);
    quizzes.save = jest.fn(async (value) => ({ id: 'quiz-1', ...value }));
    quizzes.delete = jest.fn();
    (modulesRepository as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    const created = await service.createQuiz('course-1', instructor, {
      title: 'Check', description: 'Short', passingPercentage: 60, moduleId: 'mod-1',
    });
    expect(created.title).toBe('Check');
    const updated = await service.updateQuiz('quiz-1', instructor, { title: 'Renamed', passingPercentage: 70 });
    expect(updated.title).toBe('Renamed');
    (attemptsRepository as { count: jest.Mock }).count = jest.fn().mockResolvedValue(2);
    await expect(service.removeQuiz('quiz-1', instructor)).rejects.toThrow('Cannot delete a quiz that has attempts');
    (attemptsRepository as { find: jest.Mock }).find = jest.fn().mockResolvedValue([{ id: 'attempt-1' }]);
    await expect(service.listAttempts('quiz-1', learner)).resolves.toHaveLength(1);
  });

  it('adds a question when exactly one option is correct', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    const question = await service.addQuestion('quiz-1', { ...learner, role: UserRole.INSTRUCTOR }, {
      questionText: 'Pick one',
      sequence: 1,
      options: [
        { optionText: 'A', isCorrect: true },
        { optionText: 'B', isCorrect: false },
      ],
    });
    expect(question.options).toHaveLength(2);
  });

  it('updates and deletes a question that has no responses', async () => {
    const instructor = { ...learner, role: UserRole.INSTRUCTOR };
    const questions = questionsRepository as unknown as { findOne: jest.Mock; delete: jest.Mock };
    const responses = responsesRepository as unknown as { count: jest.Mock };
    questions.findOne = jest.fn().mockResolvedValue({
      id: 'q1',
      quizId: 'quiz-1',
      questionText: 'Old',
      sequence: 1,
      quiz: { courseId: 'course-1' },
      options: [],
    });
    questions.delete = jest.fn();
    responses.count = jest.fn().mockResolvedValue(0);
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    const updated = await service.updateQuestion('q1', instructor, {
      questionText: 'New question',
      sequence: 2,
      options: [
        { optionText: 'A', isCorrect: true },
        { optionText: 'B', isCorrect: false },
      ],
    });
    expect(updated.questionText).toBe('New question');
    await expect(service.removeQuestion('q1', instructor)).resolves.toEqual({ message: 'Question deleted' });
  });

  it('rejects a duplicate answer and an empty quiz', async () => {
    await expect(service.submit('quiz-1', learner, {
      answers: [
        { questionId: 'q1', selectedOptionId: 'o1' },
        { questionId: 'q1', selectedOptionId: 'o2' },
      ],
    })).rejects.toBeInstanceOf(BadRequestException);
    quizzesRepository.findOne.mockResolvedValue({ ...quiz, questions: [], course: quiz.course });
    await expect(service.submit('quiz-1', learner, {
      answers: [{ questionId: 'q1', selectedOptionId: 'o1' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a question that does not have exactly one correct option', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    await expect(
      service.addQuestion('quiz-1', { ...learner, role: UserRole.INSTRUCTOR }, {
        questionText: 'Pick one',
        options: [
          { optionText: 'A', isCorrect: true },
          { optionText: 'B', isCorrect: true },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
