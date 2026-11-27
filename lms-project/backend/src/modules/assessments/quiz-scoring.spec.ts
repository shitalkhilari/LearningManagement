import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';
import { scoreQuiz } from './quiz-scoring';

describe('scoreQuiz', () => {
  it('marks a pass when the percentage meets the passing mark', () => {
    expect(scoreQuiz(1, 2, 50)).toMatchObject({
      score: 1,
      correctAnswers: 1,
      incorrectAnswers: 1,
      percentage: 50,
      status: QuizAttemptStatus.PASS,
    });
  });

  it('marks a fail when the percentage is below the passing mark', () => {
    expect(scoreQuiz(1, 2, 70).status).toBe(QuizAttemptStatus.FAIL);
  });

  it('does not trust a score larger than the question count', () => {
    expect(scoreQuiz(9, 2, 50).score).toBe(2);
  });
});
