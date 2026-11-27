import { ConflictException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

describe('ModulesController', () => {
  const modulesService = {
    create: jest.fn(),
    findByCourse: jest.fn(),
    reorder: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new ModulesController(modulesService as unknown as ModulesService);
  const instructor: AuthUser = {
    id: 'inst-1',
    email: 'i@lms.local',
    firstName: 'A',
    lastName: 'B',
    role: UserRole.INSTRUCTOR,
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates module commands to the service', async () => {
    modulesService.create.mockResolvedValue({ id: 'mod-1', sequence: 1 });
    modulesService.findByCourse.mockResolvedValue([{ id: 'mod-1' }]);
    modulesService.reorder.mockResolvedValue([{ id: 'mod-2' }]);
    modulesService.update.mockResolvedValue({ id: 'mod-1', title: 'Renamed' });
    modulesService.remove.mockResolvedValue({ message: 'Module deleted' });

    await expect(controller.create(instructor, 'course-1', { title: 'Basics', description: 'First' })).resolves.toMatchObject({
      sequence: 1,
    });
    await expect(controller.findByCourse(instructor, 'course-1')).resolves.toHaveLength(1);
    await expect(controller.reorder(instructor, 'course-1', { orderedIds: ['mod-2', 'mod-1'] })).resolves.toEqual([
      { id: 'mod-2' },
    ]);
    await expect(controller.update(instructor, 'mod-1', { title: 'Renamed' })).resolves.toMatchObject({ title: 'Renamed' });
    await expect(controller.remove(instructor, 'mod-1')).resolves.toEqual({ message: 'Module deleted' });
    expect(modulesService.reorder).toHaveBeenCalledWith('course-1', instructor, ['mod-2', 'mod-1']);
  });

  it('propagates a conflict when the module has lesson progress', async () => {
    modulesService.remove.mockRejectedValue(new ConflictException('Cannot delete a module that has lesson progress'));
    await expect(controller.remove(instructor, 'mod-1')).rejects.toThrow('Cannot delete a module that has lesson progress');
  });
});
