import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
  const usersService = { findOne: jest.fn() };
  const strategy = new JwtStrategy(
    configService as unknown as ConfigService,
    usersService as unknown as UsersService,
  );

  beforeEach(() => usersService.findOne.mockReset());

  it('reads the jwt secret while it is constructed', () => {
    const localConfig = { getOrThrow: jest.fn().mockReturnValue('another-secret') };
    new JwtStrategy(localConfig as unknown as ConfigService, usersService as unknown as UsersService);
    expect(localConfig.getOrThrow).toHaveBeenCalledWith('jwt.secret');
  });

  it('rejects a token for an inactive account', async () => {
    usersService.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@lms.local',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.LEARNER,
      isActive: false,
    });
    await expect(strategy.validate({ sub: 'u1', email: 'a@lms.local', role: UserRole.LEARNER })).rejects.toThrow(
      new UnauthorizedException('Account is inactive'),
    );
  });

  it('returns the current user without the password hash', async () => {
    usersService.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@lms.local',
      firstName: 'Amina',
      lastName: 'Khan',
      role: UserRole.ADMIN,
      isActive: true,
      password: 'hashed',
    });
    await expect(strategy.validate({ sub: 'u1', email: 'a@lms.local', role: UserRole.ADMIN })).resolves.toEqual({
      id: 'u1',
      email: 'a@lms.local',
      firstName: 'Amina',
      lastName: 'Khan',
      role: UserRole.ADMIN,
      isActive: true,
    });
    expect(usersService.findOne).toHaveBeenCalledWith('u1');
  });
});
