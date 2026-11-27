import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from './enrollments.service';

const learner: AuthUser = {
  id: 'learner-1',
  email: 'learner1@lms.local',
  firstName: 'Noah',
  lastName: 'Patel',
  role: UserRole.LEARNER,
  isActive: true,
};
const instructor: AuthUser = { ...learner, id: 'inst-1', role: UserRole.INSTRUCTOR };
const admin: AuthUser = { ...learner, id: 'admin-1', role: UserRole.ADMIN };

describe('EnrollmentsService', () => {
  const enrollmentsRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'enr-1', ...value })),
  };
  const coursesService = {
    getVisibleCourse: jest.fn(),
  };
  const service = new EnrollmentsService(
    enrollmentsRepository as never,
    coursesService as unknown as CoursesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('enrolls a learner in a published course', async () => {
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    enrollmentsRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'enr-1',
        learnerId: learner.id,
        courseId: 'course-1',
        course: { instructorId: 'inst-1' },
        learner: { id: learner.id },
      });
    const result = await service.enroll(learner, { courseId: 'course-1' });
    expect(result.id).toBe('enr-1');
    expect(enrollmentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ learnerId: learner.id, status: 'ACTIVE' }),
    );
  });

  it('rejects a duplicate enrollment', async () => {
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    enrollmentsRepository.findOne.mockResolvedValue({ id: 'enr-1' });
    await expect(service.enroll(learner, { courseId: 'course-1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects enrollment by an instructor', async () => {
    await expect(
      service.enroll({ ...learner, role: UserRole.INSTRUCTOR }, { courseId: 'course-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes the enrollment list to the current learner', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'enr-1' }], 1]),
    };
    (enrollmentsRepository as { createQueryBuilder?: jest.Mock }).createQueryBuilder = jest.fn().mockReturnValue(qb);
    (enrollmentsRepository as { find?: jest.Mock }).find = jest.fn().mockResolvedValue([{ id: 'enr-1' }]);
    const page = await service.findAll(learner, { page: 1, limit: 10, status: 'ACTIVE' as never });
    expect(page.meta.total).toBe(1);
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.learnerId = :learnerId', { learnerId: learner.id });
    await expect(service.findMine(learner)).resolves.toHaveLength(1);
    enrollmentsRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing', learner)).rejects.toThrow('Enrollment not found');
  });

  it('rejects a learner reading another learner enrollment', () => {
    expect(() =>
      service.assertCanView(learner, {
        learnerId: 'other',
        course: { instructorId: 'inst-1' },
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('treats an unpublished course as missing and allows staff to view their enrollments', async () => {
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.DRAFT });
    await expect(service.enroll(learner, { courseId: 'course-1' })).rejects.toBeInstanceOf(NotFoundException);

    expect(() => service.assertCanView(admin, { learnerId: 'other' } as never)).not.toThrow();
    expect(() =>
      service.assertCanView(instructor, { learnerId: 'other', course: { instructorId: instructor.id } } as never),
    ).not.toThrow();
    expect(() =>
      service.assertCanView(instructor, { learnerId: 'other', course: { instructorId: 'someone-else' } } as never),
    ).toThrow(ForbiddenException);
    expect(() => service.assertCanView(instructor, { learnerId: 'other', course: undefined } as never)).toThrow(
      ForbiddenException,
    );
  });

  it('filters enrollments for an instructor and an admin', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'enr-1' }], 1]),
    };
    (enrollmentsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest
      .fn()
      .mockReturnValue(qb);

    await service.findAll(instructor, { courseId: 'course-1', page: 1, limit: 10 });
    expect(qb.andWhere).toHaveBeenCalledWith('course.instructorId = :instructorId', { instructorId: instructor.id });
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.courseId = :courseId', { courseId: 'course-1' });

    await service.findAll(admin, {
      learnerId: 'learner-1',
      status: 'COMPLETED' as never,
      search: 'noah',
      page: 1,
      limit: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.learnerId = :filterLearner', { filterLearner: 'learner-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('(course.title ILIKE :search OR learner.email ILIKE :search)', {
      search: '%noah%',
    });
  });

  it('does not let a learner filter the list down to another learner', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    (enrollmentsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest
      .fn()
      .mockReturnValue(qb);
    await service.findAll(learner, { learnerId: 'someone-else', page: 1, limit: 10 });
    expect(qb.andWhere).not.toHaveBeenCalledWith('enrollment.learnerId = :filterLearner', expect.anything());
    expect(qb.andWhere).toHaveBeenCalledWith('enrollment.learnerId = :learnerId', { learnerId: learner.id });
  });
});
