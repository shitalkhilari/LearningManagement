import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('token-1'),
  };
  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('registers a learner and ignores any requested role', async () => {
    usersService.create.mockResolvedValue({ id: 'u1', role: UserRole.LEARNER });
    await service.register({
      firstName: 'Ravi',
      lastName: 'Shah',
      email: 'ravi@lms.local',
      password: 'Learner@123',
    });
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.LEARNER, email: 'ravi@lms.local' }),
    );
  });

  it('rejects an unknown email', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login({ email: 'missing@lms.local', password: 'Learner@123' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a wrong password', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'a@lms.local',
      password: 'hashed',
      isActive: true,
      firstName: 'A',
      lastName: 'B',
      role: UserRole.LEARNER,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.login({ email: 'a@lms.local', password: 'wrong-password' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive account after the password matches', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'a@lms.local',
      password: 'hashed',
      isActive: false,
      firstName: 'A',
      lastName: 'B',
      role: UserRole.LEARNER,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(service.login({ email: 'a@lms.local', password: 'Learner@123' })).rejects.toThrow(
      'Account is inactive',
    );
  });

  it('returns a token and user without the password hash', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      email: 'a@lms.local',
      password: 'hashed',
      isActive: true,
      firstName: 'A',
      lastName: 'B',
      role: UserRole.ADMIN,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('token-1');
    const result = await service.login({ email: 'a@lms.local', password: 'Learner@123' });
    expect(result.accessToken).toBe('token-1');
    expect(result.user).toEqual({
      id: 'u1',
      email: 'a@lms.local',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.ADMIN,
      isActive: true,
    });
    expect(result.user).not.toHaveProperty('password');
  });
});
