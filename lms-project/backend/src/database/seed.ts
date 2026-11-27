import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from './data-source';
import { User } from '../modules/users/entities/user.entity';
import { Course } from '../modules/courses/entities/course.entity';
import { CourseModule } from '../modules/modules/entities/course-module.entity';
import { Lesson } from '../modules/lessons/entities/lesson.entity';
import { Enrollment } from '../modules/enrollments/entities/enrollment.entity';
import { LessonProgress } from '../modules/progress/entities/lesson-progress.entity';
import { Quiz } from '../modules/assessments/entities/quiz.entity';
import { QuizQuestion } from '../modules/assessments/entities/quiz-question.entity';
import { QuizOption } from '../modules/assessments/entities/quiz-option.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CourseStatus } from '../common/enums/course-status.enum';
import { EnrollmentStatus } from '../common/enums/enrollment-status.enum';

config();

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

async function seed() {
  const usersPath = path.resolve(__dirname, '../../../database/seeds/users.json');
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8')) as SeedUser[];
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const courseRepo = AppDataSource.getRepository(Course);
  const moduleRepo = AppDataSource.getRepository(CourseModule);
  const lessonRepo = AppDataSource.getRepository(Lesson);
  const enrollmentRepo = AppDataSource.getRepository(Enrollment);
  const progressRepo = AppDataSource.getRepository(LessonProgress);
  const quizRepo = AppDataSource.getRepository(Quiz);
  const questionRepo = AppDataSource.getRepository(QuizQuestion);
  const optionRepo = AppDataSource.getRepository(QuizOption);

  const existing = await userRepo.count();
  if (existing > 0) {
    console.log('Database already has users. Seed skipped.');
    await AppDataSource.destroy();
    return;
  }

  const savedUsers = new Map<string, User>();
  for (const item of users) {
    const password = await bcrypt.hash(item.password, 10);
    const user = await userRepo.save(
      userRepo.create({
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        password,
        role: item.role,
        isActive: true,
      }),
    );
    savedUsers.set(item.email, user);
  }

  const instructor1 = savedUsers.get('instructor1@lms.local')!;
  const instructor2 = savedUsers.get('instructor2@lms.local')!;
  const learner1 = savedUsers.get('learner1@lms.local')!;
  const learner2 = savedUsers.get('learner2@lms.local')!;

  const nestCourse = await courseRepo.save(
    courseRepo.create({
      title: 'NestJS Fundamentals',
      description: 'Learn modules, controllers, services, and PostgreSQL with a small LMS-style API.',
      thumbnail: 'https://placehold.co/640x360?text=NestJS',
      instructorId: instructor1.id,
      status: CourseStatus.PUBLISHED,
    }),
  );
  const sqlCourse = await courseRepo.save(
    courseRepo.create({
      title: 'SQL for Application Developers',
      description: 'Practice tables, keys, and queries used by a learning platform.',
      thumbnail: 'https://placehold.co/640x360?text=SQL',
      instructorId: instructor1.id,
      status: CourseStatus.PUBLISHED,
    }),
  );
  const draftCourse = await courseRepo.save(
    courseRepo.create({
      title: 'React Patterns Draft',
      description: 'A draft course that learners must not see until it is published.',
      thumbnail: 'https://placehold.co/640x360?text=Draft',
      instructorId: instructor2.id,
      status: CourseStatus.DRAFT,
    }),
  );

  const nestModules = await moduleRepo.save([
    moduleRepo.create({
      courseId: nestCourse.id,
      title: 'Application structure',
      description: 'How a NestJS application is organized.',
      sequence: 1,
    }),
    moduleRepo.create({
      courseId: nestCourse.id,
      title: 'Request handling',
      description: 'Guards, pipes, and controllers.',
      sequence: 2,
    }),
  ]);
  const sqlModules = await moduleRepo.save([
    moduleRepo.create({
      courseId: sqlCourse.id,
      title: 'Tables and keys',
      description: 'Primary keys, foreign keys, and unique constraints.',
      sequence: 1,
    }),
    moduleRepo.create({
      courseId: sqlCourse.id,
      title: 'Queries',
      description: 'Filtering and joining related rows.',
      sequence: 2,
    }),
  ]);
  await moduleRepo.save(
    moduleRepo.create({
      courseId: draftCourse.id,
      title: 'Components',
      description: 'Draft notes about components.',
      sequence: 1,
    }),
  );

  const sampleVideos = [
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    'https://download.samplelib.com/mp4/sample-5s.mp4',
    'https://download.samplelib.com/mp4/sample-10s.mp4',
  ];
  const lessons = await lessonRepo.save([
    lessonRepo.create({
      moduleId: nestModules[0].id,
      title: 'Modules and providers',
      description: 'What a module owns.',
      content: 'A module declares controllers and providers that belong together.',
      videoUrl: sampleVideos[0],
      sequence: 1,
    }),
    lessonRepo.create({
      moduleId: nestModules[0].id,
      title: 'Dependency injection',
      description: 'How services are created.',
      content: 'Nest creates a service once and injects it where the constructor asks for it.',
      videoUrl: sampleVideos[1],
      sequence: 2,
    }),
    lessonRepo.create({
      moduleId: nestModules[1].id,
      title: 'Guards',
      description: 'Who may call an endpoint.',
      content: 'A guard runs before the controller and can reject the request.',
      videoUrl: sampleVideos[2],
      sequence: 1,
    }),
    lessonRepo.create({
      moduleId: sqlModules[0].id,
      title: 'Primary keys',
      description: 'Identifying a row.',
      content: 'A primary key uniquely identifies each row in a table.',
      videoUrl: sampleVideos[3],
      sequence: 1,
    }),
    lessonRepo.create({
      moduleId: sqlModules[0].id,
      title: 'Foreign keys',
      description: 'Connecting tables.',
      content: 'A foreign key stores the primary key of a related row.',
      videoUrl: sampleVideos[4],
      sequence: 2,
    }),
    lessonRepo.create({
      moduleId: sqlModules[1].id,
      title: 'Joins',
      description: 'Reading related data.',
      content: 'A join combines rows from two tables using a shared key.',
      videoUrl: sampleVideos[5],
      sequence: 1,
    }),
  ]);

  const enrollment = await enrollmentRepo.save(
    enrollmentRepo.create({
      learnerId: learner1.id,
      courseId: nestCourse.id,
      status: EnrollmentStatus.ACTIVE,
    }),
  );
  await enrollmentRepo.save(
    enrollmentRepo.create({
      learnerId: learner2.id,
      courseId: sqlCourse.id,
      status: EnrollmentStatus.ACTIVE,
    }),
  );
  await progressRepo.save(
    progressRepo.create({
      enrollmentId: enrollment.id,
      lessonId: lessons[0].id,
      isCompleted: true,
      completedAt: new Date(),
    }),
  );

  const nestQuiz = await quizRepo.save(
    quizRepo.create({
      courseId: nestCourse.id,
      moduleId: nestModules[0].id,
      title: 'NestJS basics quiz',
      description: 'Check the first module.',
    }),
  );
  const sqlQuiz = await quizRepo.save(
    quizRepo.create({
      courseId: sqlCourse.id,
      moduleId: sqlModules[0].id,
      title: 'Keys quiz',
      description: 'Check primary and foreign keys.',
    }),
  );

  const q1 = await questionRepo.save(
    questionRepo.create({
      quizId: nestQuiz.id,
      questionText: 'Where should business rules live?',
      sequence: 1,
    }),
  );
  await optionRepo.save([
    optionRepo.create({ questionId: q1.id, optionText: 'In the controller only', isCorrect: false }),
    optionRepo.create({ questionId: q1.id, optionText: 'In the service', isCorrect: true }),
    optionRepo.create({ questionId: q1.id, optionText: 'In the React page', isCorrect: false }),
    optionRepo.create({ questionId: q1.id, optionText: 'In the database password', isCorrect: false }),
  ]);
  const q2 = await questionRepo.save(
    questionRepo.create({
      quizId: nestQuiz.id,
      questionText: 'What does a guard do?',
      sequence: 2,
    }),
  );
  await optionRepo.save([
    optionRepo.create({ questionId: q2.id, optionText: 'It decides if a request may continue', isCorrect: true }),
    optionRepo.create({ questionId: q2.id, optionText: 'It stores the database password', isCorrect: false }),
    optionRepo.create({ questionId: q2.id, optionText: 'It renders the course page', isCorrect: false }),
    optionRepo.create({ questionId: q2.id, optionText: 'It replaces the database', isCorrect: false }),
  ]);
  const q3 = await questionRepo.save(
    questionRepo.create({
      quizId: sqlQuiz.id,
      questionText: 'What does a foreign key reference?',
      sequence: 1,
    }),
  );
  await optionRepo.save([
    optionRepo.create({ questionId: q3.id, optionText: 'A related primary key', isCorrect: true }),
    optionRepo.create({ questionId: q3.id, optionText: 'A CSS class', isCorrect: false }),
    optionRepo.create({ questionId: q3.id, optionText: 'A React component', isCorrect: false }),
    optionRepo.create({ questionId: q3.id, optionText: 'A JWT secret', isCorrect: false }),
  ]);

  console.log('Seed data created.');
  await AppDataSource.destroy();
}

seed().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
