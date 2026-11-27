import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { AppDataSource } from '../src/database/data-source';
import { UserRole } from '../src/common/enums/user-role.enum';

describe('LMS e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DB_NAME = process.env.DB_NAME_TEST || process.env.DB_NAME || 'lms_test';
    await AppDataSource.setOptions({ database: process.env.DB_NAME }).initialize();
    await AppDataSource.runMigrations();
    await AppDataSource.query(`
      TRUNCATE quiz_responses, quiz_attempts, quiz_options, quiz_questions, quizzes,
      lesson_progress, enrollments, lessons, course_modules, courses, users CASCADE
    `);
    await AppDataSource.destroy();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new LoggingInterceptor(), new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the learning workflow and blocks the wrong roles', async () => {
    const server = app.getHttpServer();
    const register = await request(server).post('/api/auth/register').send({
      firstName: 'Ravi', lastName: 'Shah', email: 'ravi.e2e@lms.local', password: 'Learner@123',
    });
    expect(register.status).toBe(201);
    expect(register.body.role).toBe('LEARNER');
    expect(register.body.password).toBeUndefined();

    const rejectedRole = await request(server).post('/api/auth/register').send({
      firstName: 'Bad', lastName: 'Role', email: 'bad@lms.local', password: 'Learner@123', role: 'ADMIN',
    });
    expect(rejectedRole.status).toBe(400);

    const badLogin = await request(server).post('/api/auth/login').send({
      email: 'ravi.e2e@lms.local', password: 'wrong-password',
    });
    expect(badLogin.status).toBe(401);

    const learnerLogin = await request(server).post('/api/auth/login').send({
      email: 'ravi.e2e@lms.local', password: 'Learner@123',
    });
    expect(learnerLogin.status).toBe(200);
    const learnerToken = learnerLogin.body.accessToken as string;

    const bcrypt = await import('bcrypt');
    const { User } = await import('../src/modules/users/entities/user.entity');
    const connection = await AppDataSource.initialize();
    const admin = await connection.getRepository(User).save(connection.getRepository(User).create({
      firstName: 'Amina', lastName: 'Khan', email: 'admin.e2e@lms.local',
      password: await bcrypt.hash('Admin@123', 10), role: UserRole.ADMIN, isActive: true,
    }));
    await connection.destroy();
    expect(admin.id).toBeDefined();

    const adminLogin = await request(server).post('/api/auth/login').send({
      email: 'admin.e2e@lms.local', password: 'Admin@123',
    });
    const adminToken = adminLogin.body.accessToken as string;
    const instructor = await request(server).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Rahul', lastName: 'Mehta', email: 'instructor.e2e@lms.local', password: 'Instructor@123', role: 'INSTRUCTOR',
    });
    expect(instructor.status).toBe(201);

    const instructorLogin = await request(server).post('/api/auth/login').send({
      email: 'instructor.e2e@lms.local', password: 'Instructor@123',
    });
    const instructorToken = instructorLogin.body.accessToken as string;

    const denied = await request(server).post('/api/courses').set('Authorization', `Bearer ${learnerToken}`).send({
      title: 'Blocked', description: 'Learners cannot create courses',
    });
    expect(denied.status).toBe(403);

    const course = await request(server).post('/api/courses').set('Authorization', `Bearer ${instructorToken}`).send({
      title: 'E2E NestJS', description: 'A course created in the end-to-end test',
    });
    expect(course.status).toBe(201);
    const courseId = course.body.id as string;

    const other = await request(server).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Sofia', lastName: 'Almeida', email: 'other.e2e@lms.local', password: 'Instructor@123', role: 'INSTRUCTOR',
    });
    const otherLogin = await request(server).post('/api/auth/login').send({
      email: 'other.e2e@lms.local', password: 'Instructor@123',
    });
    expect(other.status).toBe(201);
    const forbiddenEdit = await request(server).patch(`/api/courses/${courseId}`).set('Authorization', `Bearer ${otherLogin.body.accessToken}`).send({ title: 'Stolen' });
    expect(forbiddenEdit.status).toBe(403);

    const moduleResponse = await request(server).post(`/api/courses/${courseId}/modules`).set('Authorization', `Bearer ${instructorToken}`).send({
      title: 'Basics', description: 'First module',
    });
    const lesson = await request(server).post(`/api/modules/${moduleResponse.body.id}/lessons`).set('Authorization', `Bearer ${instructorToken}`).send({
      title: 'Services', description: 'Where rules live', content: 'Business rules live in services.',
    });
    const quiz = await request(server).post(`/api/courses/${courseId}/quizzes`).set('Authorization', `Bearer ${instructorToken}`).send({
      title: 'Check', description: 'One question', passingPercentage: 50,
    });
    const question = await request(server).post(`/api/quizzes/${quiz.body.id}/questions`).set('Authorization', `Bearer ${instructorToken}`).send({
      questionText: 'Where do business rules live?',
      options: [
        { optionText: 'In the service', isCorrect: true },
        { optionText: 'In the browser only', isCorrect: false },
      ],
    });
    expect(question.status).toBe(201);

    const unpublished = await request(server).post('/api/enrollments').set('Authorization', `Bearer ${learnerToken}`).send({ courseId });
    expect(unpublished.status).toBe(404);

    const published = await request(server).post(`/api/courses/${courseId}/publish`).set('Authorization', `Bearer ${instructorToken}`);
    expect(published.status).toBe(201);
    expect(published.body.status).toBe('PUBLISHED');

    const enrollment = await request(server).post('/api/enrollments').set('Authorization', `Bearer ${learnerToken}`).send({ courseId });
    expect(enrollment.status).toBe(201);
    const duplicate = await request(server).post('/api/enrollments').set('Authorization', `Bearer ${learnerToken}`).send({ courseId });
    expect(duplicate.status).toBe(409);

    const hidden = await request(server).get(`/api/quizzes/${quiz.body.id}`).set('Authorization', `Bearer ${learnerToken}`);
    expect(JSON.stringify(hidden.body)).not.toContain('"isCorrect":true');

    const completion = await request(server).post(`/api/progress/lessons/${lesson.body.id}/complete`).set('Authorization', `Bearer ${learnerToken}`);
    expect(completion.status).toBe(201);
    expect(completion.body.completionPercentage).toBe(100);
    expect(completion.body.enrollmentStatus).toBe('COMPLETED');

    const correctId = question.body.options.find((option: { isCorrect: boolean }) => option.isCorrect).id;
    const submitted = await request(server).post(`/api/quizzes/${quiz.body.id}/submit`).set('Authorization', `Bearer ${learnerToken}`).send({
      answers: [{ questionId: question.body.id, selectedOptionId: correctId }],
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.score).toBe(1);
    expect(submitted.body.status).toBe('PASS');

    const report = await request(server).get(`/api/reports/learners/${learnerLogin.body.user.id}/progress`).set('Authorization', `Bearer ${instructorToken}`);
    expect(report.status).toBe(200);
    expect(report.body[0].completionPercentage).toBe(100);
  });
});
