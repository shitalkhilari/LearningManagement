import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

describe('AssessmentsController', () => {
  const assessmentsService = {
    createQuiz: jest.fn(),
    listByCourse: jest.fn(),
    findOne: jest.fn(),
    updateQuiz: jest.fn(),
    removeQuiz: jest.fn(),
    addQuestion: jest.fn(),
    updateQuestion: jest.fn(),
    removeQuestion: jest.fn(),
    submit: jest.fn(),
    listAttempts: jest.fn(),
    findAttempt: jest.fn(),
  };
  const controller = new AssessmentsController(assessmentsService as unknown as AssessmentsService);
  const learner: AuthUser = {
    id: 'learner-1',
    email: 'learner1@lms.local',
    firstName: 'Noah',
    lastName: 'Patel',
    role: UserRole.LEARNER,
    isActive: true,
  };
  const options = [
    { optionText: 'A', isCorrect: true },
    { optionText: 'B', isCorrect: false },
    { optionText: 'C', isCorrect: false },
    { optionText: 'D', isCorrect: false },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('delegates quiz and question commands to the service', async () => {
    assessmentsService.createQuiz.mockResolvedValue({ id: 'quiz-1' });
    assessmentsService.listByCourse.mockResolvedValue([{ id: 'quiz-1' }]);
    assessmentsService.findOne.mockResolvedValue({ id: 'quiz-1' });
    assessmentsService.updateQuiz.mockResolvedValue({ id: 'quiz-1', title: 'Renamed' });
    assessmentsService.removeQuiz.mockResolvedValue({ message: 'Quiz deleted' });
    assessmentsService.addQuestion.mockResolvedValue({ id: 'q1', options });
    assessmentsService.updateQuestion.mockResolvedValue({ id: 'q1', questionText: 'Updated' });
    assessmentsService.removeQuestion.mockResolvedValue({ message: 'Question deleted' });
    assessmentsService.submit.mockResolvedValue({ score: 1, status: 'PASS' });
    assessmentsService.listAttempts.mockResolvedValue([{ id: 'attempt-1' }]);
    assessmentsService.findAttempt.mockResolvedValue({ id: 'attempt-1' });

    const instructor = { ...learner, role: UserRole.INSTRUCTOR };
    await expect(
      controller.createQuiz(instructor, 'course-1', { title: 'Check', description: 'Short', moduleId: 'mod-1' }),
    ).resolves.toEqual({ id: 'quiz-1' });
    await expect(controller.listByCourse(learner, 'course-1')).resolves.toHaveLength(1);
    await expect(controller.findOne(learner, 'quiz-1')).resolves.toEqual({ id: 'quiz-1' });
    await expect(controller.updateQuiz(instructor, 'quiz-1', { title: 'Renamed' })).resolves.toMatchObject({
      title: 'Renamed',
    });
    await expect(controller.removeQuiz(instructor, 'quiz-1')).resolves.toEqual({ message: 'Quiz deleted' });
    await expect(
      controller.addQuestion(instructor, 'quiz-1', { questionText: 'Pick one', options }),
    ).resolves.toMatchObject({ id: 'q1' });
    await expect(controller.updateQuestion(instructor, 'q1', { questionText: 'Updated' })).resolves.toMatchObject({
      questionText: 'Updated',
    });
    await expect(controller.removeQuestion(instructor, 'q1')).resolves.toEqual({ message: 'Question deleted' });
    await expect(
      controller.submit(learner, 'quiz-1', { answers: [{ questionId: 'q1', selectedOptionId: 'o1' }] }),
    ).resolves.toMatchObject({ status: 'PASS' });
    await expect(controller.listAttempts(learner, 'quiz-1')).resolves.toHaveLength(1);
    await expect(controller.findAttempt(learner, 'attempt-1')).resolves.toEqual({ id: 'attempt-1' });
  });

  it('propagates a bad submission and a forbidden attempt lookup', async () => {
    assessmentsService.submit.mockRejectedValue(new BadRequestException('All questions must be answered'));
    await expect(controller.submit(learner, 'quiz-1', { answers: [] })).rejects.toThrow('All questions must be answered');
    assessmentsService.findAttempt.mockRejectedValue(
      new ForbiddenException('You can only view your own quiz attempts'),
    );
    await expect(controller.findAttempt(learner, 'attempt-2')).rejects.toThrow('You can only view your own quiz attempts');
  });
});
