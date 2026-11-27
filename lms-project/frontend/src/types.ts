export type Role = 'ADMIN' | 'INSTRUCTOR' | 'LEARNER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  instructorId: string;
  status: 'DRAFT' | 'PUBLISHED';
  instructor?: AuthUser;
  modules?: CourseModule[];
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sequence: number;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  content: string;
  sequence: number;
}

export interface Enrollment {
  id: string;
  learnerId: string;
  courseId: string;
  enrolledAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  course?: Course;
  learner?: AuthUser;
}

export interface ProgressReport {
  learner: Pick<AuthUser, 'id' | 'firstName' | 'lastName' | 'email'>;
  course: { id: string; title: string; status: string };
  enrollmentId: string;
  enrolledAt: string;
  totalModules: number;
  totalLessons: number;
  completedLessons: number;
  pendingLessons: number;
  completionPercentage: number;
  enrollmentStatus: string;
}

export interface QuizOption {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect?: boolean;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  sequence: number;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  description: string;
  passingPercentage: number;
  questions?: QuizQuestion[];
}

export interface QuizResult {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  percentage: number;
  status: 'PASS' | 'FAIL';
  submittedAt: string;
}
