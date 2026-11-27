import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('stores the allowed roles on the handler', () => {
    class SampleController {
      @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
      manage() {
        return true;
      }
    }

    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, new SampleController().manage)).toEqual([
      UserRole.ADMIN,
      UserRole.INSTRUCTOR,
    ]);
  });
});
