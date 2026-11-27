import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { calculateCompletion } from './progress.calculator';

describe('calculateCompletion', () => {
  it('returns zero when a course has no lessons', () => {
    expect(calculateCompletion(0, 0)).toEqual({
      percentage: 0,
      status: EnrollmentStatus.ACTIVE,
      pendingLessons: 0,
    });
  });

  it('calculates a partial percentage and keeps the enrollment active', () => {
    expect(calculateCompletion(1, 3)).toEqual({
      percentage: 33.33,
      status: EnrollmentStatus.ACTIVE,
      pendingLessons: 2,
    });
  });

  it('marks the enrollment completed when every lesson is done', () => {
    expect(calculateCompletion(4, 4).status).toBe(EnrollmentStatus.COMPLETED);
    expect(calculateCompletion(4, 4).percentage).toBe(100);
  });
});
