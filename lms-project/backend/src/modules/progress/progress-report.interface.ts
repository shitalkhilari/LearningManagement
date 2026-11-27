export interface ProgressReport {
  learner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  course: {
    id: string;
    title: string;
    status: string;
  };
  enrollmentId: string;
  enrolledAt: Date;
  totalModules: number;
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  completionPercentage: number;
  enrollmentStatus: string;
}
