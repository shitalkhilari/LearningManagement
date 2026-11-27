import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonProgress } from './entities/lesson-progress.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CourseModule } from '../modules/entities/course-module.entity';
import { Quiz } from '../assessments/entities/quiz.entity';
import { QuizAttempt } from '../assessments/entities/quiz-attempt.entity';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LessonProgress, Enrollment, Lesson, CourseModule, Quiz, QuizAttempt])],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
