import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginate } from '../../common/utils/pagination';
import { CoursesService } from '../courses/courses.service';
import { Enrollment } from './entities/enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments-query.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    private readonly coursesService: CoursesService,
  ) {}

  async enroll(actor: AuthUser, dto: CreateEnrollmentDto): Promise<Enrollment> {
    if (actor.role !== UserRole.LEARNER) {
      throw new ForbiddenException('Only learners can enroll in a course');
    }
    const course = await this.coursesService.getVisibleCourse(dto.courseId, actor);
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }
    const existing = await this.enrollmentsRepository.findOne({
      where: { learnerId: actor.id, courseId: course.id },
    });
    if (existing) {
      throw new ConflictException('You are already enrolled in this course');
    }
    const enrollment = this.enrollmentsRepository.create({
      learnerId: actor.id,
      courseId: course.id,
      status: EnrollmentStatus.ACTIVE,
    });
    const saved = await this.enrollmentsRepository.save(enrollment);
    return this.findOne(saved.id, actor);
  }

  async findAll(actor: AuthUser, query: ListEnrollmentsQueryDto): Promise<PaginatedResult<Enrollment>> {
    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.course', 'course')
      .leftJoinAndSelect('course.instructor', 'instructor')
      .leftJoinAndSelect('enrollment.learner', 'learner')
      .orderBy('enrollment.enrolledAt', 'DESC');

    if (actor.role === UserRole.LEARNER) {
      qb.andWhere('enrollment.learnerId = :learnerId', { learnerId: actor.id });
    } else if (actor.role === UserRole.INSTRUCTOR) {
      qb.andWhere('course.instructorId = :instructorId', { instructorId: actor.id });
    }

    if (query.courseId) {
      qb.andWhere('enrollment.courseId = :courseId', { courseId: query.courseId });
    }
    if (query.learnerId && actor.role !== UserRole.LEARNER) {
      qb.andWhere('enrollment.learnerId = :filterLearner', { filterLearner: query.learnerId });
    }
    if (query.status) {
      qb.andWhere('enrollment.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('(course.title ILIKE :search OR learner.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    return paginate(qb, query.page, query.limit);
  }

  async findMine(actor: AuthUser): Promise<Enrollment[]> {
    return this.enrollmentsRepository.find({
      where: { learnerId: actor.id },
      relations: { course: { instructor: true } },
      order: { enrolledAt: 'DESC' },
    });
  }

  async findOne(id: string, actor: AuthUser): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
      relations: { course: { instructor: true }, learner: true },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    this.assertCanView(actor, enrollment);
    return enrollment;
  }

  assertCanView(actor: AuthUser, enrollment: Enrollment): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role === UserRole.LEARNER && enrollment.learnerId === actor.id) {
      return;
    }
    if (actor.role === UserRole.INSTRUCTOR && enrollment.course?.instructorId === actor.id) {
      return;
    }
    throw new ForbiddenException('You cannot view this enrollment');
  }
}
