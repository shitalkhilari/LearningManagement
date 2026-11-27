import { QuizAttemptStatus } from '../../common/enums/quiz-attempt-status.enum';

export interface QuizScore {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  percentage: number;
  status: QuizAttemptStatus;
}

export function scoreQuiz(correctAnswers: number, totalQuestions: number): QuizScore {
  const safeTotal = Math.max(totalQuestions, 0);
  const safeCorrect = Math.min(Math.max(correctAnswers, 0), safeTotal);
  const percentage = safeTotal === 0 ? 0 : Math.round((safeCorrect / safeTotal) * 10000) / 100;
  const passed = safeTotal > 0 && safeCorrect === safeTotal;
  return {
    score: safeCorrect,
    totalQuestions: safeTotal,
    correctAnswers: safeCorrect,
    incorrectAnswers: safeTotal - safeCorrect,
    percentage,
    status: passed ? QuizAttemptStatus.PASS : QuizAttemptStatus.FAIL,
  };
}
