import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateQuestionDto } from '../../modules/assessments/dto/create-question.dto';
import { SubmitQuizDto } from '../../modules/assessments/dto/submit-quiz.dto';
import { RegisterDto } from '../../modules/auth/dto/register.dto';
import { CreateCourseDto } from '../../modules/courses/dto/create-course.dto';
import { CreateLessonDto } from '../../modules/lessons/dto/create-lesson.dto';
import { PaginationQueryDto } from './pagination-query.dto';

describe('request validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  function body(metatype: new (...args: unknown[]) => unknown, value: unknown) {
    return pipe.transform(value, { type: 'body', metatype, data: '' });
  }

  function query(metatype: new (...args: unknown[]) => unknown, value: unknown) {
    return pipe.transform(value, { type: 'query', metatype, data: '' });
  }

  it('accepts a learner registration and rejects a client-supplied role', async () => {
    const created = await body(RegisterDto, {
      firstName: 'Ravi',
      lastName: 'Shah',
      email: 'ravi@lms.local',
      password: 'Learner@123',
    });
    expect(created).toMatchObject({ email: 'ravi@lms.local' });

    await expect(
      body(RegisterDto, {
        firstName: 'Ravi',
        lastName: 'Shah',
        email: 'ravi@lms.local',
        password: 'Learner@123',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a short password and an invalid email', async () => {
    await expect(
      body(RegisterDto, { firstName: 'Ravi', lastName: 'Shah', email: 'not-an-email', password: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a course without a title and a lesson with a non-http video url', async () => {
    await expect(body(CreateCourseDto, { title: '', description: 'A course' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      body(CreateLessonDto, {
        title: 'Intro',
        description: 'About',
        content: 'Body',
        videoUrl: 'ftp://files.example.com/intro.mp4',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a question that does not have four options', async () => {
    await expect(
      body(CreateQuestionDto, {
        questionText: 'Pick one',
        options: [
          { optionText: 'A', isCorrect: true },
          { optionText: 'B', isCorrect: false },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty quiz submission and a non-uuid answer', async () => {
    await expect(body(SubmitQuizDto, { answers: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      body(SubmitQuizDto, { answers: [{ questionId: 'question', selectedOptionId: 'option' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('coerces pagination query numbers and rejects a limit above 100', async () => {
    const page = await query(PaginationQueryDto, { page: '2', limit: '25', search: 'nest' });
    expect(page).toMatchObject({ page: 2, limit: 25, search: 'nest' });
    await expect(query(PaginationQueryDto, { page: '0', limit: '101' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
