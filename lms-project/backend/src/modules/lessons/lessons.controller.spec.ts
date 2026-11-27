import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

describe('LessonsController', () => {
  const lessonsService = {
    create: jest.fn(),
    findByModule: jest.fn(),
    reorder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new LessonsController(lessonsService as unknown as LessonsService);
  const learner: AuthUser = {
    id: 'learner-1',
    email: 'l@lms.local',
    firstName: 'N',
    lastName: 'P',
    role: UserRole.LEARNER,
    isActive: true,
  };
  const lesson = {
    title: 'Intro',
    description: 'About',
    content: 'Body',
    videoUrl: 'https://example.com/intro.mp4',
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates lesson commands to the service', async () => {
    lessonsService.create.mockResolvedValue({ id: 'lesson-1', sequence: 1 });
    lessonsService.findByModule.mockResolvedValue([{ id: 'lesson-1' }]);
    lessonsService.reorder.mockResolvedValue([{ id: 'lesson-2' }]);
    lessonsService.findOne.mockResolvedValue({ id: 'lesson-1' });
    lessonsService.update.mockResolvedValue({ id: 'lesson-1', content: 'Updated' });
    lessonsService.remove.mockResolvedValue({ message: 'Lesson deleted' });

    await expect(controller.create(learner, 'mod-1', lesson)).resolves.toMatchObject({ sequence: 1 });
    await expect(controller.findByModule(learner, 'mod-1')).resolves.toHaveLength(1);
    await expect(controller.reorder(learner, 'mod-1', { orderedIds: ['lesson-2', 'lesson-1'] })).resolves.toEqual([
      { id: 'lesson-2' },
    ]);
    await expect(controller.findOne(learner, 'lesson-1')).resolves.toEqual({ id: 'lesson-1' });
    await expect(controller.update(learner, 'lesson-1', { content: 'Updated' })).resolves.toMatchObject({
      content: 'Updated',
    });
    await expect(controller.remove(learner, 'lesson-1')).resolves.toEqual({ message: 'Lesson deleted' });
    expect(lessonsService.reorder).toHaveBeenCalledWith('mod-1', learner, ['lesson-2', 'lesson-1']);
  });

  it('propagates an enrollment error when a learner opens a lesson', async () => {
    lessonsService.findOne.mockRejectedValue(new ForbiddenException('Enroll in the course before opening its lessons'));
    await expect(controller.findOne(learner, 'lesson-1')).rejects.toThrow(
      'Enroll in the course before opening its lessons',
    );
  });
});
