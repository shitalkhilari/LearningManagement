import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  const reportsService = {
    overview: jest.fn(),
    learnerProgress: jest.fn(),
    courseEnrollments: jest.fn(),
    courseCompletion: jest.fn(),
    quizPerformance: jest.fn(),
  };
  const controller = new ReportsController(reportsService as unknown as ReportsService);
  const admin: AuthUser = {
    id: 'admin-1',
    email: 'a@lms.local',
    firstName: 'A',
    lastName: 'K',
    role: UserRole.ADMIN,
    isActive: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates each report to the service', async () => {
    reportsService.overview.mockResolvedValue({ totalCourses: 4 });
    reportsService.learnerProgress.mockResolvedValue([{ completionPercentage: 100 }]);
    reportsService.courseEnrollments.mockResolvedValue({ total: 2 });
    reportsService.courseCompletion.mockResolvedValue({ completed: 1 });
    reportsService.quizPerformance.mockResolvedValue({ passed: 1 });

    await expect(controller.overview(admin)).resolves.toEqual({ totalCourses: 4 });
    await expect(controller.learnerProgress(admin, 'learner-1', {})).resolves.toHaveLength(1);
    await expect(controller.courseEnrollments(admin, 'course-1', {})).resolves.toEqual({ total: 2 });
    await expect(controller.courseCompletion(admin, 'course-1', {})).resolves.toEqual({ completed: 1 });
    await expect(controller.quizPerformance(admin, 'quiz-1')).resolves.toEqual({ passed: 1 });
  });

  it('propagates a forbidden learner report and a missing quiz', async () => {
    reportsService.learnerProgress.mockRejectedValue(
      new ForbiddenException('You can only view your own progress report'),
    );
    await expect(controller.learnerProgress({ ...admin, role: UserRole.LEARNER }, 'other', {})).rejects.toThrow(
      'You can only view your own progress report',
    );
    reportsService.quizPerformance.mockRejectedValue(new NotFoundException('Quiz not found'));
    await expect(controller.quizPerformance(admin, 'missing')).rejects.toThrow('Quiz not found');
  });
});
