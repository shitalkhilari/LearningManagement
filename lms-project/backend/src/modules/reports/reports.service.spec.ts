import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { ProgressService } from '../progress/progress.service';
import { ReportsService } from './reports.service';

const admin: AuthUser = {
  id: 'admin-1', email: 'a@lms.local', firstName: 'A', lastName: 'K', role: UserRole.ADMIN, isActive: true,
};
const instructor: AuthUser = { ...admin, id: 'inst-1', role: UserRole.INSTRUCTOR };
const learner: AuthUser = { ...admin, id: 'learner-1', role: UserRole.LEARNER };

const report = {
  learner: { id: 'learner-1', firstName: 'N', lastName: 'P', email: 'n@lms.local' },
  course: { id: 'course-1', title: 'Nest', status: 'PUBLISHED' },
  enrollmentId: 'enr-1',
  enrolledAt: new Date('2026-03-01'),
  totalModules: 1,
  totalLessons: 2,
  completedLessons: 2,
  pendingLessons: 0,
  completionPercentage: 100,
  enrollmentStatus: 'COMPLETED',
};

describe('ReportsService', () => {
  const usersService = { countByRole: jest.fn() };
  const coursesService = { getManagedCourse: jest.fn() };
  const progressService = { listMine: jest.fn(), listForLearner: jest.fn(), syncAndBuild: jest.fn() };
  const coursesRepository = { find: jest.fn(), count: jest.fn() };
  const enrollmentsRepository = { createQueryBuilder: jest.fn(), count: jest.fn(), find: jest.fn() };
  const quizzesRepository = { findOne: jest.fn() };
  const attemptsRepository = { find: jest.fn() };
  const service = new ReportsService(
    usersService as unknown as UsersService,
    coursesService as unknown as CoursesService,
    progressService as unknown as ProgressService,
    coursesRepository as never,
    enrollmentsRepository as never,
    quizzesRepository as never,
    attemptsRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns admin, instructor, and learner dashboard numbers', async () => {
    usersService.countByRole.mockResolvedValue({ totalUsers: 6, totalLearners: 3, totalInstructors: 2, totalAdmins: 1 });
    coursesRepository.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    enrollmentsRepository.count.mockResolvedValue(5);
    await expect(service.overview(admin)).resolves.toMatchObject({ totalCourses: 4, publishedCourses: 3, totalEnrollments: 5 });

    coursesRepository.find.mockResolvedValue([
      { status: CourseStatus.PUBLISHED },
      { status: CourseStatus.DRAFT },
    ]);
    enrollmentsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });
    await expect(service.overview(instructor)).resolves.toMatchObject({ coursesCreated: 2, draftCourses: 1, totalEnrollments: 2 });

    progressService.listMine.mockResolvedValue([report]);
    await expect(service.overview(learner)).resolves.toMatchObject({ enrolledCourses: 1, completedCourses: 1, averageCompletion: 100 });
  });

  it('stops a learner from reading another learner report', async () => {
    await expect(service.learnerProgress(learner, 'other', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits an instructor progress report to owned courses', async () => {
    coursesRepository.find.mockResolvedValue([{ id: 'course-1' }]);
    progressService.listForLearner.mockResolvedValue([report]);
    const rows = await service.learnerProgress(instructor, 'learner-1', { status: EnrollmentStatus.COMPLETED });
    expect(progressService.listForLearner).toHaveBeenCalledWith('learner-1', ['course-1']);
    expect(rows).toHaveLength(1);
  });

  it('builds course enrollment and completion reports', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1', title: 'Nest', status: 'PUBLISHED' });
    enrollmentsRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'enr-1' }]),
    });
    const enrollments = await service.courseEnrollments(admin, 'course-1', { status: EnrollmentStatus.ACTIVE });
    expect(enrollments.total).toBe(1);

    enrollmentsRepository.find.mockResolvedValue([{ id: 'enr-1' }]);
    progressService.syncAndBuild.mockResolvedValue(report);
    const completion = await service.courseCompletion(instructor, 'course-1', {});
    expect(completion.completed).toBe(1);
    expect(completion.averageCompletion).toBe(100);
  });

  it('summarizes a learner quiz and an instructor quiz', async () => {
    quizzesRepository.findOne.mockResolvedValue({
      id: 'quiz-1', title: 'Check', courseId: 'course-1', course: { instructorId: 'inst-1' },
    });
    attemptsRepository.find.mockResolvedValue([{ status: 'PASS', percentage: 100, learnerId: learner.id }]);
    const mine = await service.quizPerformance(learner, 'quiz-1');
    expect(mine.passed).toBe(1);
    expect(coursesService.getManagedCourse).not.toHaveBeenCalled();

    attemptsRepository.find.mockResolvedValue([
      { status: 'PASS', percentage: 80 },
      { status: 'FAIL', percentage: 20 },
    ]);
    const staff = await service.quizPerformance(instructor, 'quiz-1');
    expect(staff.failed).toBe(1);
    expect(staff.averagePercentage).toBe(50);
  });

  it('returns zero averages when a learner or a quiz has no records', async () => {
    progressService.listMine.mockResolvedValue([]);
    await expect(service.overview(learner)).resolves.toEqual({
      enrolledCourses: 0,
      completedCourses: 0,
      averageCompletion: 0,
    });

    quizzesRepository.findOne.mockResolvedValue(null);
    await expect(service.quizPerformance(instructor, 'missing')).rejects.toBeInstanceOf(NotFoundException);

    quizzesRepository.findOne.mockResolvedValue({
      id: 'quiz-1',
      title: 'Check',
      courseId: 'course-1',
      course: { instructorId: instructor.id },
    });
    attemptsRepository.find.mockResolvedValue([]);
    const emptyQuiz = await service.quizPerformance(learner, 'quiz-1');
    expect(emptyQuiz.averagePercentage).toBe(0);
    expect(emptyQuiz.failed).toBe(0);
  });

  it('filters learner progress by course and enrollment date', async () => {
    coursesRepository.find.mockResolvedValue([{ id: 'course-1' }, { id: 'course-2' }]);
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    progressService.listForLearner.mockResolvedValue([
      report,
      { ...report, enrollmentId: 'enr-2', enrolledAt: new Date('2026-01-01'), enrollmentStatus: 'ACTIVE', completionPercentage: 10 },
    ]);

    const instructorRows = await service.learnerProgress(instructor, 'learner-1', {
      courseId: 'course-1',
      from: '2026-02-01',
      to: '2026-03-01',
    });
    expect(progressService.listForLearner).toHaveBeenCalledWith('learner-1', ['course-1']);
    expect(instructorRows).toHaveLength(1);
    expect(instructorRows[0].enrollmentId).toBe('enr-1');

    progressService.listForLearner.mockResolvedValue([report]);
    const learnerRows = await service.learnerProgress(learner, learner.id, {
      courseId: 'course-1',
      to: '2026-02-01',
    });
    expect(coursesService.getManagedCourse).toHaveBeenCalledTimes(1);
    expect(learnerRows).toEqual([]);

    const outside = await service.learnerProgress(admin, 'learner-1', { from: '2026-04-01' });
    expect(progressService.listForLearner).toHaveBeenCalledWith('learner-1', undefined);
    expect(outside).toEqual([]);
  });

  it('applies enrollment dates and completion status to course reports', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1', title: 'Nest', status: 'PUBLISHED' });
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    enrollmentsRepository.createQueryBuilder.mockReturnValue(qb);
    const enrollments = await service.courseEnrollments(instructor, 'course-1', {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(enrollments.total).toBe(0);
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.enrolledAt >= :from', { from: '2026-01-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.enrolledAt <= :to', { to: '2026-12-31' });

    enrollmentsRepository.find.mockResolvedValue([{ id: 'enr-1' }, { id: 'enr-2' }]);
    progressService.syncAndBuild
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({ ...report, enrollmentId: 'enr-2', enrollmentStatus: 'ACTIVE', completionPercentage: 40 });
    const completion = await service.courseCompletion(admin, 'course-1', { status: EnrollmentStatus.ACTIVE });
    expect(completion.enrolled).toBe(1);
    expect(completion.completed).toBe(0);
    expect(completion.active).toBe(1);
    expect(completion.averageCompletion).toBe(40);
  });
});
