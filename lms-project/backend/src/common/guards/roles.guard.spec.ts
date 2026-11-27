import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { AuthUser } from '../interfaces/auth-user.interface';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function context(user?: AuthUser): ExecutionContext {
    return {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  const learner: AuthUser = {
    id: 'learner-1',
    email: 'learner1@lms.local',
    firstName: 'Noah',
    lastName: 'Patel',
    role: UserRole.LEARNER,
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('allows the request when the route does not declare roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context(learner))).toBe(true);
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('rejects a request that has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(context())).toBe(false);
  });

  it('allows a matching role and rejects a different role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.INSTRUCTOR]);
    expect(guard.canActivate(context(learner))).toBe(false);
    expect(guard.canActivate(context({ ...learner, role: UserRole.INSTRUCTOR }))).toBe(true);
  });
});
