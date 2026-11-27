import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { LessonsService } from './lessons.service';

const learner: AuthUser = {
  id: 'learner-1', email: 'l@lms.local', firstName: 'N', lastName: 'P', role: UserRole.LEARNER, isActive: true,
};
const instructor: AuthUser = { ...learner, id: 'inst-1', role: UserRole.INSTRUCTOR };

describe('LessonsService', () => {
  const lessonsRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'lesson-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const modulesRepository = { findOne: jest.fn() };
  const enrollmentsRepository = { findOne: jest.fn() };
  const progressRepository = { count: jest.fn() };
  const coursesService = { getManagedCourse: jest.fn(), getVisibleCourse: jest.fn() };
  const dataSource = { transaction: jest.fn(async (work: (manager: { update: jest.Mock }) => Promise<void>) => work({ update: jest.fn() })) };
  const service = new LessonsService(
    lessonsRepository as never,
    modulesRepository as never,
    enrollmentsRepository as never,
    progressRepository as never,
    coursesService as unknown as CoursesService,
    dataSource as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates the next lesson in a module', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    lessonsRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: '0' }),
    });
    const lesson = await service.create('mod-1', instructor, {
      title: 'Intro', description: 'About', content: 'Body',
    });
    expect(lesson.sequence).toBe(1);
  });

  it('lets an enrolled learner list lessons', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    enrollmentsRepository.findOne.mockResolvedValue({ id: 'enr-1' });
    lessonsRepository.find.mockResolvedValue([{ id: 'lesson-1' }]);
    await expect(service.findByModule('mod-1', learner)).resolves.toHaveLength(1);
  });

  it('blocks a learner who has not enrolled', async () => {
    lessonsRepository.findOne.mockResolvedValue({ id: 'lesson-1', module: { courseId: 'course-1' } });
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1', status: CourseStatus.PUBLISHED });
    enrollmentsRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('lesson-1', learner)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates and refuses to delete a lesson that has progress', async () => {
    lessonsRepository.findOne.mockResolvedValue({
      id: 'lesson-1', title: 'Old', description: 'Old', content: 'Old', module: { courseId: 'course-1' },
    });
    const updated = await service.update('lesson-1', instructor, { content: 'New body' });
    expect(updated.content).toBe('New body');
    progressRepository.count.mockResolvedValue(1);
    await expect(service.remove('lesson-1', instructor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a reorder that omits a lesson', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    lessonsRepository.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.reorder('mod-1', instructor, ['a'])).rejects.toBeInstanceOf(BadRequestException);
  });
});
