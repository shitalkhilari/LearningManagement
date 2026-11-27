import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

  it('scores an incorrect submission as a fail', async () => {
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

  it('requires a module when creating a quiz', async () => {
    const instructor = { ...learner, role: UserRole.INSTRUCTOR };
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    await expect(
      service.createQuiz('course-1', instructor, {
        title: 'Check',
        description: 'Short',
        moduleId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      title: 'Check', description: 'Short', moduleId: 'mod-1',
    });
    expect(created.title).toBe('Check');
    const updated = await service.updateQuiz('quiz-1', instructor, { title: 'Renamed' });
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
        { optionText: 'C', isCorrect: false },
        { optionText: 'D', isCorrect: false },
      ],
    });
    expect(question.options).toHaveLength(4);
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
        { optionText: 'C', isCorrect: false },
        { optionText: 'D', isCorrect: false },
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
          { optionText: 'C', isCorrect: false },
          { optionText: 'D', isCorrect: false },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a question that does not have four options', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    await expect(
      service.addQuestion('quiz-1', { ...learner, role: UserRole.INSTRUCTOR }, {
        questionText: 'Pick one',
        options: [
          { optionText: 'A', isCorrect: true },
          { optionText: 'B', isCorrect: false },
          { optionText: 'C', isCorrect: false },
        ],
      }),
    ).rejects.toThrow('Each question must have exactly four options');
  });

  const instructor = { ...learner, id: 'inst-1', role: UserRole.INSTRUCTOR };
  const fourOptions = [
    { optionText: 'A', isCorrect: true },
    { optionText: 'B', isCorrect: false },
    { optionText: 'C', isCorrect: false },
    { optionText: 'D', isCorrect: false },
  ];

  it('lists quizzes for an instructor and hides a draft from a learner', async () => {
    (quizzesRepository as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue([
      { ...quiz, questions: undefined },
      {
        ...quiz,
        id: 'quiz-2',
        questions: [
          {
            id: 'q9',
            questionText: 'Q',
            sequence: 2,
            options: [{ id: 'o9', questionId: 'q9', optionText: 'A', isCorrect: true }],
          },
        ],
      },
    ]);
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    const visible = await service.listByCourse('course-1', instructor);
    expect(visible[0].questions).toBeUndefined();
    const hidden = await service.listByCourse('course-1', learner);
    expect((hidden[1].questions[0].options[0] as { isCorrect?: boolean }).isCorrect).toBeUndefined();

    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.DRAFT });
    await expect(service.findOne('quiz-1', learner)).rejects.toThrow('Quiz not found');
    enrollmentsRepository.findOne.mockResolvedValue(null);
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    await expect(service.listByCourse('course-1', learner)).rejects.toThrow(
      'Enroll in the course before viewing its quizzes',
    );
  });

  it('rejects a missing quiz, a module from another course, and a non-learner submission', async () => {
    quizzesRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('missing', instructor)).rejects.toBeInstanceOf(NotFoundException);

    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    (modulesRepository as unknown as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue({
      id: 'mod-9',
      courseId: 'other-course',
    });
    await expect(
      service.createQuiz('course-1', instructor, { title: 'Check', description: 'Short', moduleId: 'mod-9' }),
    ).rejects.toThrow('moduleId must belong to the same course');
    (modulesRepository as unknown as { findOne: jest.Mock }).findOne.mockResolvedValue(null);
    await expect(
      service.updateQuiz('quiz-1', instructor, { moduleId: 'missing' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.submit('quiz-1', instructor, { answers: [{ questionId: 'q1', selectedOptionId: 'o1' }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    quizzesRepository.findOne.mockResolvedValue({ ...quiz, course: { ...quiz.course, status: CourseStatus.DRAFT } });
    await expect(
      service.submit('quiz-1', learner, { answers: [{ questionId: 'q1', selectedOptionId: 'o1' }] }),
    ).rejects.toThrow('Quiz not found');
  });

  it('updates the description, deletes a quiz with no attempts, and lists staff attempts', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    const quizzes = quizzesRepository as unknown as { save: jest.Mock; delete: jest.Mock };
    quizzes.save = jest.fn(async (value) => value);
    quizzes.delete = jest.fn();
    (modulesRepository as unknown as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue({
      id: 'mod-2',
      courseId: 'course-1',
    });
    const updated = await service.updateQuiz('quiz-1', instructor, { description: ' Longer ', moduleId: 'mod-2' });
    expect(updated.description).toBe('Longer');
    expect(quizzes.save).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'mod-2' }));

    (attemptsRepository as unknown as { count: jest.Mock; find: jest.Mock }).count = jest.fn().mockResolvedValue(0);
    await expect(service.removeQuiz('quiz-1', instructor)).resolves.toEqual({ message: 'Quiz deleted' });
    (attemptsRepository as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue([{ id: 'attempt-2' }]);
    await expect(service.listAttempts('quiz-1', instructor)).resolves.toEqual([{ id: 'attempt-2' }]);
    expect((attemptsRepository as unknown as { find: jest.Mock }).find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quizId: 'quiz-1' } }),
    );
  });

  it('assigns the next sequence and refuses to change options that were already answered', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    (questionsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
    });
    const created = await service.addQuestion('quiz-1', instructor, { questionText: ' Next ', options: fourOptions });
    expect(created.sequence).toBe(1);
    expect(created.questionText).toBe('Next');

    const questions = questionsRepository as unknown as { findOne: jest.Mock; delete: jest.Mock };
    const responses = responsesRepository as unknown as { count: jest.Mock };
    questions.findOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'q1',
        questionText: 'Old',
        sequence: 1,
        quiz: { courseId: 'course-1' },
        options: [],
      })
      .mockResolvedValue({
        id: 'q1',
        questionText: 'Old',
        sequence: 1,
        quiz: { courseId: 'course-1' },
        options: [],
      });
    await expect(service.updateQuestion('missing', instructor, { questionText: 'New' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    responses.count = jest.fn().mockResolvedValue(2);
    await expect(service.updateQuestion('q1', instructor, { options: fourOptions })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const textOnly = await service.updateQuestion('q1', instructor, { questionText: ' Reworded ' });
    expect(textOnly.questionText).toBe('Reworded');

    questions.findOne.mockResolvedValueOnce(null);
    await expect(service.removeQuestion('missing', instructor)).rejects.toThrow('Question not found');
    questions.findOne.mockResolvedValue({ id: 'q1', quiz: { courseId: 'course-1' } });
    responses.count.mockResolvedValue(3);
    await expect(service.removeQuestion('q1', instructor)).rejects.toThrow(
      'Cannot delete a question that has responses',
    );
  });

  it('rejects a submission that does not include every question', async () => {
    quizzesRepository.findOne.mockResolvedValue({
      ...quiz,
      questions: [quiz.questions[0], { ...quiz.questions[0], id: 'q2', sequence: 2 }],
    });
    await expect(
      service.submit('quiz-1', learner, {
        answers: [{ questionId: 'q1', selectedOptionId: 'o1' }],
      }),
    ).rejects.toThrow('All questions must be answered');
  });

  it('rejects an answer for a question that was left out of the payload', async () => {
    quizzesRepository.findOne.mockResolvedValue({
      ...quiz,
      questions: [
        quiz.questions[0],
        { ...quiz.questions[0], id: 'q2', sequence: 2 },
      ],
    });
    await expect(
      service.submit('quiz-1', learner, {
        answers: [
          { questionId: 'q1', selectedOptionId: 'o1' },
          { questionId: 'other', selectedOptionId: 'o2' },
        ],
      }),
    ).rejects.toThrow('All questions must be answered');
  });

  it('guards attempt lookups by role', async () => {
    const attempts = attemptsRepository as unknown as { findOne: jest.Mock };
    attempts.findOne = jest.fn().mockResolvedValueOnce(null);
    await expect(service.findAttempt('missing', learner)).rejects.toBeInstanceOf(NotFoundException);

    const attempt = {
      id: 'attempt-1',
      learnerId: learner.id,
      quiz: { course: { instructorId: 'inst-1' } },
    };
    attempts.findOne.mockResolvedValue(attempt);
    await expect(service.findAttempt('attempt-1', { ...learner, id: 'other' })).rejects.toThrow(
      'You can only view your own quiz attempts',
    );
    await expect(service.findAttempt('attempt-1', { ...instructor, id: 'other-inst' })).rejects.toThrow(
      'You can only view attempts for your own courses',
    );
    await expect(service.findAttempt('attempt-1', instructor)).resolves.toBe(attempt);
    await expect(service.findAttempt('attempt-1', { ...learner, id: 'admin-1', role: UserRole.ADMIN })).resolves.toBe(
      attempt,
    );
  });
});
