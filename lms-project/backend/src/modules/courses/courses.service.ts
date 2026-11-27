import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginate } from '../../common/utils/pagination';
import { User } from '../users/entities/user.entity';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { QuizAttempt } from '../assessments/entities/quiz-attempt.entity';
import { Lesson } from '../lessons/entities/lesson.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
    @InjectRepository(Lesson)
    private readonly lessonsRepository: Repository<Lesson>,
  ) {}

  async create(actor: AuthUser, dto: CreateCourseDto): Promise<Course> {
    const instructorId = await this.resolveInstructorId(actor, dto.instructorId);
    const course = this.coursesRepository.create({
      title: dto.title.trim(),
      description: dto.description.trim(),
      thumbnail: dto.thumbnail ?? null,
      instructorId,
      status: CourseStatus.DRAFT,
    });
    const saved = await this.coursesRepository.save(course);
    return this.findOne(saved.id, actor);
  }

  async findAll(actor: AuthUser, query: ListCoursesQueryDto): Promise<PaginatedResult<Course>> {
    const qb = this.coursesRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.instructor', 'instructor');

    this.applyVisibility(qb, actor);

    if (query.status) {
      if (actor.role === UserRole.LEARNER) {
        qb.andWhere('course.status = :forcedPublished', { forcedPublished: CourseStatus.PUBLISHED });
      } else if (actor.role === UserRole.INSTRUCTOR && query.status === CourseStatus.DRAFT) {
        qb.andWhere('course.instructorId = :ownerId', { ownerId: actor.id });
        qb.andWhere('course.status = :status', { status: query.status });
      } else {
        qb.andWhere('course.status = :status', { status: query.status });
      }
    }

    if (query.instructorId && actor.role !== UserRole.LEARNER) {
      qb.andWhere('course.instructorId = :instructorId', { instructorId: query.instructorId });
    }

    if (query.search) {
      qb.andWhere('(course.title ILIKE :search OR course.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`course.${sortBy}`, sortOrder);
    return paginate(qb, query.page, query.limit);
  }

  async findOne(id: string, actor: AuthUser): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: { instructor: true, modules: { lessons: true } },
    });
    if (!course || !this.canView(actor, course)) {
      throw new NotFoundException('Course not found');
    }
    course.modules = (course.modules ?? [])
      .sort((a, b) => a.sequence - b.sequence)
      .map((module) => ({
        ...module,
        lessons: (module.lessons ?? []).sort((a, b) => a.sequence - b.sequence),
      }));
    return course;
  }

  async update(id: string, actor: AuthUser, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.getManagedCourse(id, actor);
    if (dto.title !== undefined) {
      course.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      course.description = dto.description.trim();
    }
    if (dto.thumbnail !== undefined) {
      course.thumbnail = dto.thumbnail;
    }
    if (dto.instructorId !== undefined) {
      if (actor.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only an admin can reassign a course instructor');
      }
      course.instructorId = await this.requireActiveInstructor(dto.instructorId);
    }
    await this.coursesRepository.save(course);
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: AuthUser): Promise<{ message: string }> {
    await this.getManagedCourse(id, actor);
    const enrollmentCount = await this.enrollmentsRepository.count({ where: { courseId: id } });
    if (enrollmentCount > 0) {
      throw new ConflictException('Cannot delete a course that has enrollments');
    }
    const attemptCount = await this.attemptsRepository
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .where('quiz.courseId = :courseId', { courseId: id })
      .getCount();
    if (attemptCount > 0) {
      throw new ConflictException('Cannot delete a course that has quiz attempts');
    }
    await this.coursesRepository.delete(id);
    return { message: 'Course deleted' };
  }

  async publish(id: string, actor: AuthUser): Promise<Course> {
    const course = await this.getManagedCourse(id, actor);
    if (!course.title.trim() || !course.description.trim()) {
      throw new BadRequestException('A course needs a title and description before it can be published');
    }
    const lessonCount = await this.lessonsRepository
      .createQueryBuilder('lesson')
      .innerJoin('lesson.module', 'module')
      .where('module.courseId = :courseId', { courseId: id })
      .getCount();
    const moduleCount = course.modules?.length ?? 0;
    if (moduleCount < 1 || lessonCount < 1) {
      throw new BadRequestException('Publish requires at least one module and one lesson');
    }
    course.status = CourseStatus.PUBLISHED;
    await this.coursesRepository.save(course);
    return this.findOne(id, actor);
  }

  async unpublish(id: string, actor: AuthUser): Promise<Course> {
    const course = await this.getManagedCourse(id, actor);
    course.status = CourseStatus.DRAFT;
    await this.coursesRepository.save(course);
    return this.findOne(id, actor);
  }

  async getManagedCourse(id: string, actor: AuthUser): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: { modules: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    this.assertCanManage(actor, course);
    return course;
  }

  async getVisibleCourse(id: string, actor: AuthUser): Promise<Course> {
    const course = await this.coursesRepository.findOne({ where: { id } });
    if (!course || !this.canView(actor, course)) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  assertCanManage(actor: AuthUser, course: Pick<Course, 'instructorId'>): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role === UserRole.INSTRUCTOR && course.instructorId === actor.id) {
      return;
    }
    throw new ForbiddenException('You can only manage your own courses');
  }

  canView(actor: AuthUser, course: Pick<Course, 'status' | 'instructorId'>): boolean {
    if (actor.role === UserRole.ADMIN) {
      return true;
    }
    if (course.status === CourseStatus.PUBLISHED) {
      return true;
    }
    return actor.role === UserRole.INSTRUCTOR && course.instructorId === actor.id;
  }

  private applyVisibility(
    qb: ReturnType<Repository<Course>['createQueryBuilder']>,
    actor: AuthUser,
  ): void {
    if (actor.role === UserRole.LEARNER) {
      qb.andWhere('course.status = :published', { published: CourseStatus.PUBLISHED });
    } else if (actor.role === UserRole.INSTRUCTOR) {
      qb.andWhere('(course.instructorId = :uid OR course.status = :published)', {
        uid: actor.id,
        published: CourseStatus.PUBLISHED,
      });
    }
  }

  private async resolveInstructorId(actor: AuthUser, requestedId?: string): Promise<string> {
    if (actor.role === UserRole.INSTRUCTOR) {
      return actor.id;
    }
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only an admin or instructor can create a course');
    }
    if (!requestedId) {
      throw new BadRequestException('instructorId is required when an admin creates a course');
    }
    return this.requireActiveInstructor(requestedId);
  }

  private async requireActiveInstructor(instructorId: string): Promise<string> {
    const instructor = await this.usersRepository.findOne({ where: { id: instructorId } });
    if (!instructor || instructor.role !== UserRole.INSTRUCTOR || !instructor.isActive) {
      throw new BadRequestException('instructorId must reference an active instructor');
    }
    return instructor.id;
  }
}
