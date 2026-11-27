import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';

export interface CompletionResult {
  percentage: number;
  status: EnrollmentStatus;
  pendingLessons: number;
}

export function calculateCompletion(completedLessons: number, totalLessons: number): CompletionResult {
  if (totalLessons <= 0) {
    return {
      percentage: 0,
      status: EnrollmentStatus.ACTIVE,
      pendingLessons: 0,
    };
  }
  const safeCompleted = Math.min(Math.max(completedLessons, 0), totalLessons);
  const percentage = Math.round((safeCompleted / totalLessons) * 10000) / 100;
  return {
    percentage,
    status: safeCompleted >= totalLessons ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE,
    pendingLessons: totalLessons - safeCompleted,
  };
}
