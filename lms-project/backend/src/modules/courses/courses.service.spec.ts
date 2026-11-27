import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

  function listQuery() {
    return {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'course-1' }], 1]),
    };
  }

  it('shows an instructor their drafts and every published course', async () => {
    const qb = listQuery();
    coursesRepository.createQueryBuilder.mockReturnValue(qb);
    await service.findAll(instructor, { page: 1, limit: 10 });
    expect(qb.andWhere).toHaveBeenCalledWith('(course.instructorId = :uid OR course.status = :published)', {
      uid: instructor.id,
      published: CourseStatus.PUBLISHED,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('course.createdAt', 'DESC');
  });

  it('keeps a learner on published courses even when they ask for drafts', async () => {
    const qb = listQuery();
    coursesRepository.createQueryBuilder.mockReturnValue(qb);
    await service.findAll(learner, {
      status: CourseStatus.DRAFT,
      instructorId: 'inst-1',
      page: 1,
      limit: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('course.status = :forcedPublished', {
      forcedPublished: CourseStatus.PUBLISHED,
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith('course.instructorId = :instructorId', expect.anything());
  });

  it('limits an instructor draft filter to courses they own', async () => {
    const qb = listQuery();
    coursesRepository.createQueryBuilder.mockReturnValue(qb);
    await service.findAll(instructor, { status: CourseStatus.DRAFT, instructorId: instructor.id, page: 1, limit: 10 });
    expect(qb.andWhere).toHaveBeenCalledWith('course.instructorId = :ownerId', { ownerId: instructor.id });
    expect(qb.andWhere).toHaveBeenCalledWith('course.status = :status', { status: CourseStatus.DRAFT });
  });

  it('lets an admin filter by status, instructor, and title', async () => {
    const qb = listQuery();
    coursesRepository.createQueryBuilder.mockReturnValue(qb);
    await service.findAll(admin, {
      status: CourseStatus.PUBLISHED,
      instructorId: instructor.id,
      search: 'nest',
      sortBy: 'title',
      sortOrder: 'ASC',
      page: 1,
      limit: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('course.status = :status', { status: CourseStatus.PUBLISHED });
    expect(qb.andWhere).toHaveBeenCalledWith('course.instructorId = :instructorId', { instructorId: instructor.id });
    expect(qb.orderBy).toHaveBeenCalledWith('course.title', 'ASC');
  });

  it('sorts modules and lessons when a course is opened', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      modules: [
        { id: 'm2', sequence: 2, lessons: [{ id: 'l2', sequence: 2 }, { id: 'l1', sequence: 1 }] },
        { id: 'm1', sequence: 1, lessons: undefined },
      ],
    });
    const course = await service.findOne('course-1', instructor);
    expect(course.modules.map((module) => module.id)).toEqual(['m1', 'm2']);
    expect(course.modules[1].lessons.map((lesson) => lesson.id)).toEqual(['l1', 'l2']);
  });

  it('hides a missing course and a draft the actor cannot view', async () => {
    coursesRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing', learner)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getManagedCourse('missing', instructor)).rejects.toBeInstanceOf(NotFoundException);
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      status: CourseStatus.DRAFT,
      instructorId: 'someone-else',
    });
    await expect(service.getVisibleCourse('course-1', learner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates description and thumbnail, and blocks instructor reassignment', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      title: 'NestJS',
      description: 'Old',
      thumbnail: null,
      instructorId: instructor.id,
      status: CourseStatus.DRAFT,
      modules: [],
    });
    await service.update('course-1', instructor, { description: ' New text ', thumbnail: 'https://example.com/a.png' });
    expect(coursesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'New text', thumbnail: 'https://example.com/a.png' }),
    );
    await expect(service.update('course-1', instructor, { instructorId: 'other' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to delete a course that has quiz attempts and deletes one that has neither', async () => {
    coursesRepository.findOne.mockResolvedValue({ id: 'course-1', instructorId: instructor.id, modules: [] });
    enrollmentsRepository.count.mockResolvedValue(0);
    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });
    await expect(service.remove('course-1', instructor)).rejects.toBeInstanceOf(ConflictException);

    attemptsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    await expect(service.remove('course-1', admin)).resolves.toEqual({ message: 'Course deleted' });
    expect(coursesRepository.delete).toHaveBeenCalledWith('course-1');
  });

  it('refuses to publish a course that has no title or no module', async () => {
    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      title: '   ',
      description: 'A course',
      instructorId: instructor.id,
      modules: [{ id: 'm1' }],
    });
    await expect(service.publish('course-1', instructor)).rejects.toThrow(
      'A course needs a title and description before it can be published',
    );

    coursesRepository.findOne.mockResolvedValue({
      id: 'course-1',
      title: 'NestJS',
      description: 'A course',
      instructorId: instructor.id,
      modules: undefined,
    });
    lessonsRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    await expect(service.publish('course-1', instructor)).rejects.toThrow(
      'Publish requires at least one module and one lesson',
    );
  });

  it('rejects course creation from a learner and from an unknown instructor id', async () => {
    await expect(service.create(learner, { title: 'NestJS', description: 'A course' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    usersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.create(admin, { title: 'NestJS', description: 'A course', instructorId: 'missing' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    usersRepository.findOne.mockResolvedValue({ id: 'inst-1', role: UserRole.INSTRUCTOR, isActive: false });
    await expect(
      service.create(admin, { title: 'NestJS', description: 'A course', instructorId: 'inst-1' }),
    ).rejects.toThrow('instructorId must reference an active instructor');
  });

  it('returns a published course a learner is allowed to open', async () => {
    const visible = {
      id: 'course-1',
      status: CourseStatus.PUBLISHED,
      instructorId: instructor.id,
    };
    coursesRepository.findOne.mockResolvedValue(visible);
    await expect(service.getVisibleCourse('course-1', learner)).resolves.toBe(visible);
  });

  it('lets an admin and the owning instructor manage a course, and lets them view drafts', () => {
    expect(() => service.assertCanManage(admin, { instructorId: 'other' })).not.toThrow();
    expect(() => service.assertCanManage(instructor, { instructorId: instructor.id })).not.toThrow();
    expect(service.canView(admin, { status: CourseStatus.DRAFT, instructorId: 'other' })).toBe(true);
    expect(service.canView(instructor, { status: CourseStatus.DRAFT, instructorId: instructor.id })).toBe(true);
    expect(service.canView(instructor, { status: CourseStatus.DRAFT, instructorId: 'other' })).toBe(false);
  });
});
