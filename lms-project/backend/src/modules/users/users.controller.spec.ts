import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const usersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const controller = new UsersController(usersService as unknown as UsersService);
  const dto = {
    firstName: 'Asha',
    lastName: 'Verma',
    email: 'asha@lms.local',
    password: 'Instructor@123',
    role: UserRole.INSTRUCTOR,
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates, lists, and loads users', async () => {
    usersService.create.mockResolvedValue({ id: 'u1', email: dto.email });
    usersService.findAll.mockResolvedValue({ data: [{ id: 'u1' }], meta: { total: 1 } });
    usersService.findOne.mockResolvedValue({ id: 'u1' });

    await expect(controller.create(dto)).resolves.toMatchObject({ id: 'u1' });
    await expect(controller.findAll({ role: UserRole.INSTRUCTOR, page: 1, limit: 10 })).resolves.toMatchObject({
      meta: { total: 1 },
    });
    await expect(controller.findOne('u1')).resolves.toEqual({ id: 'u1' });
    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('propagates a missing user and updates an existing one', async () => {
    usersService.findOne.mockRejectedValue(new NotFoundException('User not found'));
    await expect(controller.findOne('missing')).rejects.toThrow('User not found');
    usersService.update.mockResolvedValue({ id: 'u1', isActive: false });
    await expect(controller.update('u1', { isActive: false })).resolves.toMatchObject({ isActive: false });
    expect(usersService.update).toHaveBeenCalledWith('u1', { isActive: false });
  });
});
