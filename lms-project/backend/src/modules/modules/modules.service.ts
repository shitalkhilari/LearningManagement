import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CoursesService } from '../courses/courses.service';
import { CourseModule } from './entities/course-module.entity';
import { LessonProgress } from '../progress/entities/lesson-progress.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(CourseModule)
    private readonly modulesRepository: Repository<CourseModule>,
    @InjectRepository(LessonProgress)
    private readonly progressRepository: Repository<LessonProgress>,
    private readonly coursesService: CoursesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(courseId: string, actor: AuthUser, dto: CreateModuleDto): Promise<CourseModule> {
    await this.coursesService.getManagedCourse(courseId, actor);
    const max = await this.modulesRepository
      .createQueryBuilder('module')
      .select('COALESCE(MAX(module.sequence), 0)', 'max')
      .where('module.courseId = :courseId', { courseId })
      .getRawOne<{ max: string }>();
    const module = this.modulesRepository.create({
      courseId,
      title: dto.title.trim(),
      description: dto.description.trim(),
      sequence: Number(max?.max ?? 0) + 1,
    });
    return this.modulesRepository.save(module);
  }

  async findByCourse(courseId: string, actor: AuthUser): Promise<CourseModule[]> {
    await this.coursesService.getVisibleCourse(courseId, actor);
    return this.modulesRepository.find({
      where: { courseId },
      order: { sequence: 'ASC' },
    });
  }

  async update(id: string, actor: AuthUser, dto: UpdateModuleDto): Promise<CourseModule> {
    const module = await this.getManagedModule(id, actor);
    if (dto.title !== undefined) {
      module.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      module.description = dto.description.trim();
    }
    return this.modulesRepository.save(module);
  }

  async remove(id: string, actor: AuthUser): Promise<{ message: string }> {
    const module = await this.getManagedModule(id, actor);
    const progressCount = await this.progressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.lesson', 'lesson')
      .where('lesson.moduleId = :moduleId', { moduleId: id })
      .getCount();
    if (progressCount > 0) {
      throw new ConflictException('Cannot delete a module that has lesson progress');
    }
    await this.modulesRepository.delete(module.id);
    return { message: 'Module deleted' };
  }

  async reorder(courseId: string, actor: AuthUser, orderedIds: string[]): Promise<CourseModule[]> {
    await this.coursesService.getManagedCourse(courseId, actor);
    const modules = await this.modulesRepository.find({ where: { courseId } });
    const existing = new Set(modules.map((module) => module.id));
    if (orderedIds.length !== modules.length || new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('orderedIds must list each module of the course exactly once');
    }
    for (const id of orderedIds) {
      if (!existing.has(id)) {
        throw new BadRequestException('orderedIds must list each module of the course exactly once');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < modules.length; index += 1) {
        await manager.update(CourseModule, modules[index].id, { sequence: -(index + 1) });
      }
      for (let index = 0; index < orderedIds.length; index += 1) {
        await manager.update(CourseModule, orderedIds[index], { sequence: index + 1 });
      }
    });

    return this.modulesRepository.find({ where: { courseId }, order: { sequence: 'ASC' } });
  }

  async getManagedModule(id: string, actor: AuthUser): Promise<CourseModule> {
    const module = await this.modulesRepository.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    await this.coursesService.getManagedCourse(module.courseId, actor);
    return module;
  }
}
