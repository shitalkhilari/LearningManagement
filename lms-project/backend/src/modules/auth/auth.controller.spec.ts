import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = { register: jest.fn(), login: jest.fn() };
  const controller = new AuthController(authService as unknown as AuthService);
  const registerDto = {
    firstName: 'Ravi',
    lastName: 'Shah',
    email: 'ravi@lms.local',
    password: 'Learner@123',
  };

  beforeEach(() => jest.clearAllMocks());

  it('registers a learner through the auth service', async () => {
    authService.register.mockResolvedValue({ id: 'u1', email: registerDto.email, role: UserRole.LEARNER });
    await expect(controller.register(registerDto)).resolves.toMatchObject({ role: UserRole.LEARNER });
    expect(authService.register).toHaveBeenCalledWith(registerDto);
  });

  it('returns the access token from a successful login', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token-1', user: { id: 'u1' } });
    await expect(controller.login({ email: registerDto.email, password: registerDto.password })).resolves.toEqual({
      accessToken: 'token-1',
      user: { id: 'u1' },
    });
  });

  it('propagates an invalid login', async () => {
    authService.login.mockRejectedValue(new UnauthorizedException('Invalid email or password'));
    await expect(controller.login({ email: registerDto.email, password: 'wrong-password' })).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('returns the authenticated user from the request', () => {
    const user: AuthUser = {
      id: 'u1',
      email: registerDto.email,
      firstName: 'Ravi',
      lastName: 'Shah',
      role: UserRole.LEARNER,
      isActive: true,
    };
    expect(controller.me(user)).toBe(user);
  });
});
