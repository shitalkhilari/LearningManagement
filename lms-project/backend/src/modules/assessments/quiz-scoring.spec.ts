import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';
import { scoreQuiz } from './quiz-scoring';

describe('scoreQuiz', () => {
  it('marks a pass when every question is correct', () => {
    expect(scoreQuiz(2, 2)).toMatchObject({
      score: 2,
      correctAnswers: 2,
      incorrectAnswers: 0,
      percentage: 100,
      status: QuizAttemptStatus.PASS,
    });
  });

  it('marks a fail when any question is incorrect', () => {
    expect(scoreQuiz(1, 2).status).toBe(QuizAttemptStatus.FAIL);
  });

  it('does not trust a score larger than the question count', () => {
    expect(scoreQuiz(9, 2).score).toBe(2);
    expect(scoreQuiz(9, 2).status).toBe(QuizAttemptStatus.PASS);
  });

  it('returns a fail with a zero score when the quiz has no questions', () => {
    expect(scoreQuiz(0, 0)).toMatchObject({
      score: 0,
      totalQuestions: 0,
      percentage: 0,
      status: QuizAttemptStatus.FAIL,
    });
    expect(scoreQuiz(-4, -1).score).toBe(0);
  });
});
