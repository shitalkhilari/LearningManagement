import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

describe('CoursesController', () => {
  const coursesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
  };
  const controller = new CoursesController(coursesService as unknown as CoursesService);
  const instructor: AuthUser = {
    id: 'inst-1',
    email: 'instructor1@lms.local',
    firstName: 'Rahul',
    lastName: 'Mehta',
    role: UserRole.INSTRUCTOR,
    isActive: true,
  };
  const dto = { title: 'NestJS', description: 'A course' };

  beforeEach(() => jest.clearAllMocks());

  it('delegates course reads and writes to the service', async () => {
    coursesService.create.mockResolvedValue({ id: 'course-1', ...dto });
    coursesService.findAll.mockResolvedValue({ data: [], meta: { total: 0 } });
    coursesService.findOne.mockResolvedValue({ id: 'course-1' });
    coursesService.update.mockResolvedValue({ id: 'course-1', title: 'Renamed' });
    coursesService.remove.mockResolvedValue({ message: 'Course deleted' });
    coursesService.publish.mockResolvedValue({ id: 'course-1', status: 'PUBLISHED' });
    coursesService.unpublish.mockResolvedValue({ id: 'course-1', status: 'DRAFT' });

    await expect(controller.create(instructor, dto)).resolves.toMatchObject({ id: 'course-1' });
    await expect(controller.findAll(instructor, { page: 1, limit: 10 })).resolves.toMatchObject({ meta: { total: 0 } });
    await expect(controller.findOne(instructor, 'course-1')).resolves.toEqual({ id: 'course-1' });
    await expect(controller.update(instructor, 'course-1', { title: 'Renamed' })).resolves.toMatchObject({
      title: 'Renamed',
    });
    await expect(controller.remove(instructor, 'course-1')).resolves.toEqual({ message: 'Course deleted' });
    await expect(controller.publish(instructor, 'course-1')).resolves.toMatchObject({ status: 'PUBLISHED' });
    await expect(controller.unpublish(instructor, 'course-1')).resolves.toMatchObject({ status: 'DRAFT' });
    expect(coursesService.create).toHaveBeenCalledWith(instructor, dto);
  });

  it('propagates a forbidden course update', async () => {
    coursesService.update.mockRejectedValue(new ForbiddenException('You can only manage your own courses'));
    await expect(controller.update(instructor, 'course-1', { title: 'Stolen' })).rejects.toThrow(
      'You can only manage your own courses',
    );
  });
});
