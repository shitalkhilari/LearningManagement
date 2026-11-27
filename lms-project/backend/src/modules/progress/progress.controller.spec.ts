import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

describe('ProgressController', () => {
  const progressService = {
    markLessonCompleted: jest.fn(),
    listMine: jest.fn(),
    getByEnrollment: jest.fn(),
  };
  const controller = new ProgressController(progressService as unknown as ProgressService);
  const learner: AuthUser = {
    id: 'learner-1',
    email: 'learner1@lms.local',
    firstName: 'Noah',
    lastName: 'Patel',
    role: UserRole.LEARNER,
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns lesson completion and progress reports', async () => {
    progressService.markLessonCompleted.mockResolvedValue({ completionPercentage: 50 });
    progressService.listMine.mockResolvedValue([{ completionPercentage: 50 }]);
    progressService.getByEnrollment.mockResolvedValue({ enrollmentId: 'enr-1' });

    await expect(controller.complete(learner, 'lesson-1')).resolves.toEqual({ completionPercentage: 50 });
    await expect(controller.mine(learner)).resolves.toHaveLength(1);
    await expect(controller.byEnrollment(learner, 'enr-1')).resolves.toEqual({ enrollmentId: 'enr-1' });
    expect(progressService.markLessonCompleted).toHaveBeenCalledWith(learner, 'lesson-1');
  });

  it('propagates a forbidden completion', async () => {
    progressService.markLessonCompleted.mockRejectedValue(
      new ForbiddenException('Only learners can mark a lesson complete'),
    );
    await expect(controller.complete({ ...learner, role: UserRole.INSTRUCTOR }, 'lesson-1')).rejects.toThrow(
      'Only learners can mark a lesson complete',
    );
  });
});
