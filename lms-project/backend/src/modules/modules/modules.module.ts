import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { CourseModule } from './entities/course-module.entity';
import { LessonProgress } from '../progress/entities/lesson-progress.entity';
import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseModule, LessonProgress]), CoursesModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService, TypeOrmModule],
})
export class ModulesModule {}
