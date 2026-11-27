import { ForbiddenException } from '@nestjs/common';
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
  const service = new ProgressService(
    progressRepository as never,
    enrollmentsRepository as never,
    lessonsRepository as never,
    modulesRepository as never,
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

  beforeEach(() => jest.clearAllMocks());

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
    progressRepository.count.mockResolvedValue(0);
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
    progressRepository.count.mockResolvedValue(1);
    const report = await service.markLessonCompleted(learner, 'lesson-1');
    expect(progressRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'lesson-1', isCompleted: true }),
    );
    expect(report.completionPercentage).toBe(100);
    expect(report.enrollmentStatus).toBe(EnrollmentStatus.COMPLETED);
    expect(enrollmentsRepository.save).toHaveBeenCalled();
  });
});
