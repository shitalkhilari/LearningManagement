import { ConflictException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

describe('EnrollmentsController', () => {
  const enrollmentsService = {
    enroll: jest.fn(),
    findMine: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
  const controller = new EnrollmentsController(enrollmentsService as unknown as EnrollmentsService);
  const learner: AuthUser = {
    id: 'learner-1',
    email: 'learner1@lms.local',
    firstName: 'Noah',
    lastName: 'Patel',
    role: UserRole.LEARNER,
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('enrolls the learner and lists visible enrollments', async () => {
    enrollmentsService.enroll.mockResolvedValue({ id: 'enr-1' });
    enrollmentsService.findMine.mockResolvedValue([{ id: 'enr-1' }]);
    enrollmentsService.findAll.mockResolvedValue({ data: [{ id: 'enr-1' }], meta: { total: 1 } });
    enrollmentsService.findOne.mockResolvedValue({ id: 'enr-1' });

    await expect(controller.enroll(learner, { courseId: 'course-1' })).resolves.toEqual({ id: 'enr-1' });
    await expect(controller.findMine(learner)).resolves.toHaveLength(1);
    await expect(controller.findAll(learner, { page: 1, limit: 10 })).resolves.toMatchObject({ meta: { total: 1 } });
    await expect(controller.findOne(learner, 'enr-1')).resolves.toEqual({ id: 'enr-1' });
    expect(enrollmentsService.enroll).toHaveBeenCalledWith(learner, { courseId: 'course-1' });
  });

  it('propagates a duplicate enrollment', async () => {
    enrollmentsService.enroll.mockRejectedValue(new ConflictException('You are already enrolled in this course'));
    await expect(controller.enroll(learner, { courseId: 'course-1' })).rejects.toThrow(
      'You are already enrolled in this course',
    );
  });
});
