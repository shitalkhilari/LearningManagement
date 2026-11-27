import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ProgressService } from './progress.service';

const learner: AuthUser = {
  id: 'learner-1',
  email: 'learner1@lms.local',
  firstName: 'Noah',
  lastName: 'Patel',
  role: UserRole.LEARNER,
  isActive: true,
};

describe('ProgressService', () => {
  const progressRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    count: jest.fn(),
  };
  const enrollmentsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (value) => value),
  };
  const lessonsRepository = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
  const modulesRepository = { count: jest.fn() };
  const quizzesRepository = { count: jest.fn() };
  const attemptsRepository = { createQueryBuilder: jest.fn() };
  const service = new ProgressService(
    progressRepository as never,
    enrollmentsRepository as never,
    lessonsRepository as never,
    modulesRepository as never,
    quizzesRepository as never,
    attemptsRepository as never,
  );

  const enrollment = {
    id: 'enr-1',
    learnerId: learner.id,
    courseId: 'course-1',
    status: EnrollmentStatus.ACTIVE,
    enrolledAt: new Date('2026-01-01'),
    learner: { id: learner.id, firstName: 'Noah', lastName: 'Patel', email: learner.email },
    course: { id: 'course-1', title: 'NestJS', status: CourseStatus.PUBLISHED, instructorId: 'inst-1' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    progressRepository.find.mockResolvedValue([]);
    quizzesRepository.count.mockResolvedValue(0);
    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
  });

  it('refuses a learner who is not enrolled', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.PUBLISHED } },
    });
    enrollmentsRepository.findOne.mockResolvedValue(null);
    await expect(service.markLessonCompleted(learner, 'lesson-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not create a second progress row when the lesson is already complete', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.PUBLISHED } },
    });
    enrollmentsRepository.findOne.mockResolvedValue(enrollment);
    progressRepository.findOne.mockResolvedValue({ id: 'p1', isCompleted: true });
    progressRepository.find.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    modulesRepository.count.mockResolvedValue(1);
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });
    progressRepository.count.mockResolvedValue(1);
    const report = await service.markLessonCompleted(learner, 'lesson-1');
    expect(progressRepository.save).not.toHaveBeenCalled();
    expect(report.completionPercentage).toBe(50);
    expect(report.pendingLessons).toBe(1);
    expect(report.enrollmentStatus).toBe(EnrollmentStatus.ACTIVE);
  });

  it('lists the learner progress and hides another learner enrollment', async () => {
    enrollmentsRepository.find.mockResolvedValue([enrollment]);
    enrollmentsRepository.findOne.mockResolvedValue(enrollment);
    modulesRepository.count.mockResolvedValue(1);
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });
    progressRepository.find.mockResolvedValue([]);
    const rows = await service.listMine(learner);
    expect(rows[0].completionPercentage).toBe(0);
    await expect(service.getByEnrollment({ ...learner, id: 'other' }, 'enr-1')).rejects.toBeInstanceOf(ForbiddenException);
    const rowsForLearner = await service.listForLearner(learner.id, ['course-1']);
    expect(rowsForLearner).toHaveLength(1);
    const instructorView = await service.getByEnrollment({ ...learner, id: 'inst-1', role: UserRole.INSTRUCTOR }, 'enr-1');
    expect(instructorView.course.title).toBe('NestJS');
  });

  it('stores completion and marks the enrollment completed when all lessons are done', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.PUBLISHED } },
    });
    enrollmentsRepository.findOne.mockResolvedValue({ ...enrollment });
    progressRepository.findOne.mockResolvedValue(null);
    modulesRepository.count.mockResolvedValue(1);
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    progressRepository.find.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    const report = await service.markLessonCompleted(learner, 'lesson-1');
    expect(progressRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'lesson-1', isCompleted: true }),
    );
    expect(report.completionPercentage).toBe(100);
    expect(report.enrollmentStatus).toBe(EnrollmentStatus.COMPLETED);
    expect(enrollmentsRepository.save).toHaveBeenCalled();
  });

  it('keeps the course active until a required quiz is passed', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.PUBLISHED } },
    });
    enrollmentsRepository.findOne.mockResolvedValue({ ...enrollment, status: EnrollmentStatus.ACTIVE });
    progressRepository.findOne.mockResolvedValue(null);
    modulesRepository.count.mockResolvedValue(1);
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    progressRepository.find.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    quizzesRepository.count.mockResolvedValue(1);
    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    const unfinished = await service.markLessonCompleted(learner, 'lesson-1');
    expect(unfinished.completionPercentage).toBe(50);
    expect(unfinished.enrollmentStatus).toBe(EnrollmentStatus.ACTIVE);

    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ quizId: 'quiz-1' }]),
    });
    const finished = await service.syncAndBuild(enrollment.id);
    expect(finished.passedQuizzes).toBe(1);
    expect(finished.completionPercentage).toBe(100);
    expect(finished.enrollmentStatus).toBe(EnrollmentStatus.COMPLETED);
  });

  function lessonQuery(count: number) {
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(count),
    });
  }

  it('rejects staff, a missing lesson, and an unpublished lesson', async () => {
    await expect(
      service.markLessonCompleted({ ...learner, role: UserRole.INSTRUCTOR }, 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    lessonsRepository.findOne.mockResolvedValue(null);
    await expect(service.markLessonCompleted(learner, 'missing')).rejects.toBeInstanceOf(NotFoundException);

    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.DRAFT } },
    });
    await expect(service.markLessonCompleted(learner, 'lesson-1')).rejects.toThrow('Lesson not found');
  });

  it('completes a lesson that was saved as incomplete', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1', course: { status: CourseStatus.PUBLISHED } },
    });
    enrollmentsRepository.findOne.mockResolvedValue({ ...enrollment, status: EnrollmentStatus.ACTIVE });
    progressRepository.findOne.mockResolvedValue({ id: 'p1', isCompleted: false, lessonId: 'lesson-1' });
    modulesRepository.count.mockResolvedValue(1);
    lessonQuery(2);
    progressRepository.find.mockResolvedValue([{ lessonId: 'lesson-1' }]);
    const report = await service.markLessonCompleted(learner, 'lesson-1');
    expect(progressRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', isCompleted: true }));
    expect(report.completedLessons).toBe(1);
  });

  it('hides another instructor and a missing enrollment', async () => {
    enrollmentsRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.getByEnrollment(learner, 'missing')).rejects.toBeInstanceOf(NotFoundException);

    enrollmentsRepository.findOne.mockImplementation(async (query: { where?: { id?: string } }) =>
      query?.where?.id === 'enr-1' ? enrollment : null,
    );
    modulesRepository.count.mockResolvedValue(1);
    lessonQuery(2);
    await expect(
      service.getByEnrollment({ ...learner, id: 'other-inst', role: UserRole.INSTRUCTOR }, 'enr-1'),
    ).rejects.toThrow('You can only view progress for your own courses');

    const adminReport = await service.getByEnrollment({ ...learner, id: 'admin-1', role: UserRole.ADMIN }, 'enr-1');
    expect(adminReport.enrollmentId).toBe('enr-1');
    await expect(service.syncAndBuild('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters a learner report by course and reads alternate quiz id columns', async () => {
    enrollmentsRepository.find.mockResolvedValue([enrollment, { ...enrollment, id: 'enr-2', courseId: 'course-2' }]);
    enrollmentsRepository.findOne.mockImplementation(async (query: { where: { id: string } }) => {
      if (query?.where?.id === 'enr-2') {
        return { ...enrollment, id: 'enr-2', courseId: 'course-2' };
      }
      if (query?.where?.id === 'enr-1') {
        return enrollment;
      }
      return null;
    });
    modulesRepository.count.mockResolvedValue(1);
    lessonQuery(1);
    progressRepository.find.mockResolvedValue([]);
    quizzesRepository.count.mockResolvedValue(2);
    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ quizid: 'quiz-2' }, { quiz_id: 'quiz-3' }, { quizId: '' }, {}]),
    });

    const filtered = await service.listForLearner(learner.id, ['course-2']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].passedQuizzes).toBe(2);

    const all = await service.listForLearner(learner.id);
    expect(all).toHaveLength(2);
    enrollmentsRepository.find.mockResolvedValue([]);
    await expect(service.listMine(learner)).resolves.toEqual([]);
  });
});
