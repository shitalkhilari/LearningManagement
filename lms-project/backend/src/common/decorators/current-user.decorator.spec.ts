import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '../enums/user-role.enum';
import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('returns the authenticated user attached to the request', () => {
    class Probe {
      // The decorator factory is stored on this method's route metadata.
      probe(@CurrentUser() _user: unknown) {
        return _user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'probe') as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => unknown }
    >;
    const factory = metadata[Object.keys(metadata)[0]].factory;
    const user = {
      id: 'u1',
      email: 'admin@lms.local',
      firstName: 'Amina',
      lastName: 'Khan',
      role: UserRole.ADMIN,
      isActive: true,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, context)).toBe(user);
  });
});
