import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from './courses.service';

const instructor: AuthUser = {
  id: 'inst-1',
  email: 'instructor1@lms.local',
  firstName: 'Rahul',
  lastName: 'Mehta',
  role: UserRole.INSTRUCTOR,
  isActive: true,
};

const admin: AuthUser = { ...instructor, id: 'admin-1', role: UserRole.ADMIN };
const learner: AuthUser = { ...instructor, id: 'learner-1', role: UserRole.LEARNER };

describe('CoursesService', () => {
  const coursesRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'course-1', ...value })),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const usersRepository = { findOne: jest.fn() };
  const enrollmentsRepository = { count: jest.fn() };
  const attemptsRepository = { createQueryBuilder: jest.fn() };
  const lessonsRepository = { createQueryBuilder: jest.fn() };

  const service = new CoursesService(
    coursesRepository as never,
    usersRepository as never,
    enrollmentsRepository as never,
    attemptsRepository as never,
    lessonsRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('assigns the course to the instructor who creates it', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      modules: [],
      instructor: { id: instructor.id },
    });
    await service.create(instructor, {
      title: 'NestJS',
      description: 'A course',
      instructorId: 'someone-else',
    });
    expect(coursesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ instructorId: instructor.id, status: CourseStatus.DRAFT }),
    );
  });

  it('requires an active instructor when an admin creates a course', async () => {
    await expect(service.create(admin, { title: 'NestJS', description: 'A course' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    usersRepository.findOne.mockResolvedValue({ id: 'inst-1', role: UserRole.LEARNER, isActive: true });
    await expect(
      service.create(admin, { title: 'NestJS', description: 'A course', instructorId: 'inst-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks an instructor from managing another instructor course', () => {
    expect(() => service.assertCanManage(instructor, { instructorId: 'other' })).toThrow(ForbiddenException);
  });

  it('hides draft courses from learners', () => {
    expect(service.canView(learner, { status: CourseStatus.DRAFT, instructorId: instructor.id })).toBe(false);
    expect(service.canView(learner, { status: CourseStatus.PUBLISHED, instructorId: instructor.id })).toBe(true);
  });

  it('refuses to publish a course without a lesson', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      title: 'NestJS',
      description: 'A course',
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      modules: [{ id: 'm1' }],
    });
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    await expect(service.publish('course-1', instructor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only published courses for a learner', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'course-1' }], 1]),
    };
    coursesRepository.createQueryBuilder.mockReturnValue(qb);
    const page = await service.findAll(learner, { search: 'nest', page: 1, limit: 10 });
    expect(page.data).toHaveLength(1);
    expect(qb.andWhere).toHaveBeenCalledWith('course.status = :published', { published: CourseStatus.PUBLISHED });
  });

  it('publishes a complete course and can move it back to draft', async () => {
    const course = {
      id: 'course-1',
      title: 'NestJS',
      description: 'A course',
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      modules: [{ id: 'm1' }],
    };
    coursesRepository.findOne.mockResolvedValue(course);
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    await service.publish('course-1', instructor);
    expect(coursesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: CourseStatus.PUBLISHED }));
    await service.unpublish('course-1', admin);
    expect(coursesRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: CourseStatus.DRAFT }));
  });

  it('lets an admin assign an active instructor and update the title', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'inst-1', role: UserRole.INSTRUCTOR, isActive: true });
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      title: 'Old',
      description: 'A course',
      instructorId: 'inst-1',
      status: CourseStatus.DRAFT,
      modules: [],
      instructor: { id: 'inst-1' },
    });
    await service.create(admin, { title: 'NestJS', description: 'A course', instructorId: 'inst-1' });
    await service.update('course-1', admin, { title: 'Renamed', instructorId: 'inst-1' });
    expect(coursesRepository.save).toHaveBeenCalled();
  });

  it('refuses to delete a course that has enrollments', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      instructorId: instructor.id,
      modules: [],
    });
    enrollmentsRepository.count.mockResolvedValue(2);
    await expect(service.remove('course-1', instructor)).rejects.toBeInstanceOf(ConflictException);
    expect(coursesRepository.delete).not.toHaveBeenCalled();
  });
});
