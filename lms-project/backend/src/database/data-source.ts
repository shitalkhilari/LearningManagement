import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Course } from '../modules/courses/entities/course.entity';
import { CourseModule } from '../modules/modules/entities/course-module.entity';
import { Lesson } from '../modules/lessons/entities/lesson.entity';
import { Enrollment } from '../modules/enrollments/entities/enrollment.entity';
import { LessonProgress } from '../modules/progress/entities/lesson-progress.entity';
import { Quiz } from '../modules/assessments/entities/quiz.entity';
import { QuizQuestion } from '../modules/assessments/entities/quiz-question.entity';
import { QuizOption } from '../modules/assessments/entities/quiz-option.entity';
import { QuizAttempt } from '../modules/assessments/entities/quiz-attempt.entity';
import { QuizResponse } from '../modules/assessments/entities/quiz-response.entity';
import { InitialSchema1732600000000 } from './migrations/1732600000000-InitialSchema';

config();

export const entities = [
  User,
  Course,
  CourseModule,
  Lesson,
  Enrollment,
  LessonProgress,
  Quiz,
  QuizQuestion,
  QuizOption,
  QuizAttempt,
  QuizResponse,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'lms',
  entities,
  migrations: [InitialSchema1732600000000],
  synchronize: false,
});
