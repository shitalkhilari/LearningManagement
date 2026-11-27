import { ConflictException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'u1', ...value })),
    createQueryBuilder: jest.fn(),
  };
  const service = new UsersService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects a duplicate email', async () => {
    repository.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({
        firstName: 'Asha',
        lastName: 'Verma',
        email: 'asha@lms.local',
        password: 'Instructor@123',
        role: UserRole.INSTRUCTOR,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores a hash and lowercases the email', async () => {
    repository.findOne.mockResolvedValue(null);
    const user = await service.create({
      firstName: 'Asha',
      lastName: 'Verma',
      email: 'Asha@LMS.local',
      password: 'Instructor@123',
      role: UserRole.INSTRUCTOR,
    });
    expect(user.email).toBe('asha@lms.local');
    expect(user.password).toBe('hashed-password');
    expect(user.role).toBe(UserRole.INSTRUCTOR);
  });

  it('counts users by role', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { role: UserRole.LEARNER, count: '3' },
        { role: UserRole.INSTRUCTOR, count: '2' },
        { role: UserRole.ADMIN, count: '1' },
      ]),
    };
    repository.createQueryBuilder.mockReturnValue(qb);
    await expect(service.countByRole()).resolves.toEqual({
      totalUsers: 6,
      totalLearners: 3,
      totalInstructors: 2,
      totalAdmins: 1,
    });
  });

  it('lists users and updates an existing user', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'u1' }], 1]),
    };
    repository.createQueryBuilder.mockReturnValue(qb);
    const page = await service.findAll({ role: UserRole.LEARNER, search: 'asha', page: 1, limit: 10 });
    expect(page.meta.total).toBe(1);
    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow('User not found');
    repository.findOne.mockResolvedValueOnce({ id: 'u1', email: 'old@lms.local', firstName: 'A', lastName: 'B' } as User);
    const updated = await service.update('u1', { firstName: 'Ada', isActive: false, role: UserRole.ADMIN });
    expect(updated.firstName).toBe('Ada');
    expect(updated.isActive).toBe(false);
  });

  it('refuses to change an email to one that is taken', async () => {
    repository.findOne
      .mockResolvedValueOnce({ id: 'u1', email: 'old@lms.local' } as User)
      .mockResolvedValueOnce({ id: 'u2', email: 'new@lms.local' });
    await expect(service.update('u1', { email: 'new@lms.local' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('loads a user by email and includes the password column', async () => {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'asha@lms.local', password: 'hashed' }),
    };
    repository.createQueryBuilder.mockReturnValue(qb);
    await expect(service.findByEmailWithPassword('  Asha@LMS.local ')).resolves.toMatchObject({
      email: 'asha@lms.local',
      password: 'hashed',
    });
    expect(qb.addSelect).toHaveBeenCalledWith('user.password');
    expect(qb.where).toHaveBeenCalledWith('user.email = :email', { email: 'asha@lms.local' });
  });

  it('changes a free email, trims the last name, and keeps an unchanged email', async () => {
    repository.findOne
      .mockResolvedValueOnce({ id: 'u1', email: 'old@lms.local', firstName: 'A', lastName: 'B' } as User)
      .mockResolvedValueOnce(null);
    const renamed = await service.update('u1', { email: ' New@LMS.local ', lastName: ' Lovelace ' });
    expect(renamed.email).toBe('new@lms.local');
    expect(renamed.lastName).toBe('Lovelace');

    repository.findOne.mockResolvedValueOnce({ id: 'u1', email: 'old@lms.local', firstName: 'A', lastName: 'B' } as User);
    const same = await service.update('u1', { email: 'OLD@lms.local' });
    expect(same.email).toBe('old@lms.local');
  });

  it('lists every user when no role or search filter is sent', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repository.createQueryBuilder.mockReturnValue(qb);
    const page = await service.findAll({ page: 1, limit: 10 });
    expect(page.meta.total).toBe(0);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('stores an explicitly inactive user and counts missing roles as zero', async () => {
    repository.findOne.mockResolvedValue(null);
    const user = await service.create({
      firstName: ' Asha ',
      lastName: ' Verma ',
      email: 'asha@lms.local',
      password: 'Instructor@123',
      role: UserRole.INSTRUCTOR,
      isActive: false,
    });
    expect(user.firstName).toBe('Asha');
    expect(user.isActive).toBe(false);

    repository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    await expect(service.countByRole()).resolves.toEqual({
      totalUsers: 0,
      totalLearners: 0,
      totalInstructors: 0,
      totalAdmins: 0,
    });
  });
});
