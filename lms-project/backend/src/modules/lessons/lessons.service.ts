import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { CourseModule } from '../modules/entities/course-module.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonProgress } from '../progress/entities/lesson-progress.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
    @InjectRepository(CourseModule)
    private readonly modulesRepository: Repository<CourseModule>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(LessonProgress)
    private readonly progressRepository: Repository<LessonProgress>,
    private readonly coursesService: CoursesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(moduleId: string, actor: AuthUser, dto: CreateLessonDto): Promise<Lesson> {
    const module = await this.getManagedModule(moduleId, actor);
    const max = await this.lessonsRepository
      .createQueryBuilder('lesson')
      .select('COALESCE(MAX(lesson.sequence), 0)', 'max')
      .where('lesson.moduleId = :moduleId', { moduleId })
      .getRawOne<{ max: string }>();
    const lesson = this.lessonsRepository.create({
      moduleId: module.id,
      title: dto.title.trim(),
      description: dto.description.trim(),
      content: dto.content.trim(),
      videoUrl: dto.videoUrl.trim(),
      sequence: Number(max?.max ?? 0) + 1,
    });
    return this.lessonsRepository.save(lesson);
  }

  async findByModule(moduleId: string, actor: AuthUser): Promise<Lesson[]> {
    const module = await this.modulesRepository.findOne({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    const course = await this.coursesService.getVisibleCourse(module.courseId, actor);
    await this.assertLearnerEnrolled(actor, course.id, course.status);
    return this.lessonsRepository.find({
      where: { moduleId },
      order: { sequence: 'ASC' },
    });
  }

  async findOne(id: string, actor: AuthUser): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOne({
      where: { id },
      relations: { module: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const course = await this.coursesService.getVisibleCourse(lesson.module.courseId, actor);
    await this.assertLearnerEnrolled(actor, course.id, course.status);
    return lesson;
  }

  async update(id: string, actor: AuthUser, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.getManagedLesson(id, actor);
    if (dto.title !== undefined) {
      lesson.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      lesson.description = dto.description.trim();
    }
    if (dto.content !== undefined) {
      lesson.content = dto.content.trim();
    }
    if (dto.videoUrl !== undefined) {
      lesson.videoUrl = dto.videoUrl.trim();
    }
    return this.lessonsRepository.save(lesson);
  }

  async remove(id: string, actor: AuthUser): Promise<{ message: string }> {
    const lesson = await this.getManagedLesson(id, actor);
    const progressCount = await this.progressRepository.count({ where: { lessonId: id } });
    if (progressCount > 0) {
      throw new ConflictException('Cannot delete a lesson that has progress records');
    }
    await this.lessonsRepository.delete(lesson.id);
    return { message: 'Lesson deleted' };
  }

  async reorder(moduleId: string, actor: AuthUser, orderedIds: string[]): Promise<Lesson[]> {
    await this.getManagedModule(moduleId, actor);
    const lessons = await this.lessonsRepository.find({ where: { moduleId } });
    const existing = new Set(lessons.map((lesson) => lesson.id));
    if (orderedIds.length !== lessons.length || new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('orderedIds must list each lesson of the module exactly once');
    }
    for (const id of orderedIds) {
      if (!existing.has(id)) {
        throw new BadRequestException('orderedIds must list each lesson of the module exactly once');
      }
    }
    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < lessons.length; index += 1) {
        await manager.update(Lesson, lessons[index].id, { sequence: -(index + 1) });
      }
      for (let index = 0; index < orderedIds.length; index += 1) {
        await manager.update(Lesson, orderedIds[index], { sequence: index + 1 });
      }
    });
    return this.lessonsRepository.find({ where: { moduleId }, order: { sequence: 'ASC' } });
  }

  private async getManagedModule(moduleId: string, actor: AuthUser): Promise<CourseModule> {
    const module = await this.modulesRepository.findOne({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    await this.coursesService.getManagedCourse(module.courseId, actor);
    return module;
  }

  private async getManagedLesson(id: string, actor: AuthUser): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOne({ where: { id }, relations: { module: true } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    await this.coursesService.getManagedCourse(lesson.module.courseId, actor);
    return lesson;
  }

  private async assertLearnerEnrolled(
    actor: AuthUser,
    courseId: string,
    status: CourseStatus,
  ): Promise<void> {
    if (actor.role !== UserRole.LEARNER) {
      return;
    }
    if (status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Lesson not found');
    }
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { learnerId: actor.id, courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Enroll in the course before opening its lessons');
    }
  }
}
