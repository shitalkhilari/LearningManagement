import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { ModulesService } from './modules.service';

const instructor: AuthUser = {
  id: 'inst-1', email: 'i@lms.local', firstName: 'A', lastName: 'B', role: UserRole.INSTRUCTOR, isActive: true,
};

describe('ModulesService', () => {
  const modulesRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'mod-1', ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const progressRepository = { createQueryBuilder: jest.fn() };
  const coursesService = { getManagedCourse: jest.fn(), getVisibleCourse: jest.fn() };
  const dataSource = { transaction: jest.fn(async (work: (manager: { update: jest.Mock }) => Promise<void>) => work({ update: jest.fn() })) };
  const service = new ModulesService(modulesRepository as never, progressRepository as never, coursesService as unknown as CoursesService, dataSource as never);

  beforeEach(() => jest.clearAllMocks());

  it('appends a module at the next sequence', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    modulesRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: '2' }),
    });
    const created = await service.create('course-1', instructor, { title: 'Next', description: 'Details' });
    expect(created.sequence).toBe(3);
  });

  it('lists modules for a visible course', async () => {
    coursesService.getVisibleCourse.mockResolvedValue({ id: 'course-1' });
    modulesRepository.find.mockResolvedValue([{ id: 'mod-1' }]);
    await expect(service.findByCourse('course-1', instructor)).resolves.toHaveLength(1);
  });

  it('updates a module the instructor owns', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1', title: 'Old', description: 'Old' });
    const updated = await service.update('mod-1', instructor, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(coursesService.getManagedCourse).toHaveBeenCalled();
  });

  it('blocks deletion when lesson progress exists', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1' });
    progressRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    });
    await expect(service.remove('mod-1', instructor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reorders modules inside a transaction', async () => {
    modulesRepository.find.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([{ id: 'b', sequence: 1 }]);
    const result = await service.reorder('course-1', instructor, ['b', 'a']);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(result[0].id).toBe('b');
  });

  it('rejects a partial reorder list', async () => {
    modulesRepository.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.reorder('course-1', instructor, ['a'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('starts at sequence 1 when the course has no modules yet', async () => {
    coursesService.getManagedCourse.mockResolvedValue({ id: 'course-1' });
    modulesRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
    });
    const created = await service.create('course-1', instructor, { title: ' First ', description: ' Details ' });
    expect(created.sequence).toBe(1);
    expect(created.title).toBe('First');
  });

  it('updates a description and deletes a module that has no progress', async () => {
    modulesRepository.findOne.mockResolvedValue({ id: 'mod-1', courseId: 'course-1', title: 'Keep', description: 'Old' });
    const updated = await service.update('mod-1', instructor, { description: ' New ' });
    expect(updated.description).toBe('New');
    expect(updated.title).toBe('Keep');

    progressRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    await expect(service.remove('mod-1', instructor)).resolves.toEqual({ message: 'Module deleted' });
    expect(modulesRepository.delete).toHaveBeenCalledWith('mod-1');
  });

  it('rejects a missing module, a duplicate reorder, and an id from another course', async () => {
    modulesRepository.findOne.mockResolvedValue(null);
    await expect(service.update('missing', instructor, { title: 'New' })).rejects.toBeInstanceOf(NotFoundException);

    modulesRepository.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.reorder('course-1', instructor, ['a', 'a'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorder('course-1', instructor, ['a', 'c'])).rejects.toThrow(
      'orderedIds must list each module of the course exactly once',
    );
  });
});
