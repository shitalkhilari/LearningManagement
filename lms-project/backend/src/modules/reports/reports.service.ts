import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { CourseStatus } from '../../common/enums/course-status.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { ProgressService } from '../progress/progress.service';
import { ProgressReport } from '../progress/progress-report.interface';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Quiz } from '../assessments/entities/quiz.entity';
import { QuizAttempt } from '../assessments/entities/quiz-attempt.entity';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
    private readonly progressService: ProgressService,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Quiz)
    private readonly quizzesRepository: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private readonly attemptsRepository: Repository<QuizAttempt>,
  ) {}

  async overview(actor: AuthUser) {
    if (actor.role === UserRole.LEARNER) {
      const progress = await this.progressService.listMine(actor);
      return {
        enrolledCourses: progress.length,
        completedCourses: progress.filter((item) => item.enrollmentStatus === 'COMPLETED').length,
        averageCompletion: this.average(progress.map((item) => item.completionPercentage)),
      };
    }
    if (actor.role === UserRole.INSTRUCTOR) {
      const courses = await this.coursesRepository.find({ where: { instructorId: actor.id } });
      const enrollments = await this.enrollmentsRepository
        .createQueryBuilder('enrollment')
        .innerJoin('enrollment.course', 'course')
        .where('course.instructorId = :instructorId', { instructorId: actor.id })
        .getCount();
      return {
        coursesCreated: courses.length,
        publishedCourses: courses.filter((course) => course.status === CourseStatus.PUBLISHED).length,
        draftCourses: courses.filter((course) => course.status === CourseStatus.DRAFT).length,
        totalEnrollments: enrollments,
      };
    }
    const users = await this.usersService.countByRole();
    const totalCourses = await this.coursesRepository.count();
    const publishedCourses = await this.coursesRepository.count({
      where: { status: CourseStatus.PUBLISHED },
    });
    const totalEnrollments = await this.enrollmentsRepository.count();
    return {
      ...users,
      totalCourses,
      publishedCourses,
      draftCourses: totalCourses - publishedCourses,
      totalEnrollments,
    };
  }

  async learnerProgress(actor: AuthUser, learnerId: string, query: ReportQueryDto): Promise<ProgressReport[]> {
    if (actor.role === UserRole.LEARNER && actor.id !== learnerId) {
      throw new ForbiddenException('You can only view your own progress report');
    }
    let courseIds: string[] | undefined;
    if (actor.role === UserRole.INSTRUCTOR) {
      const owned = await this.coursesRepository.find({ where: { instructorId: actor.id } });
      courseIds = owned.map((course) => course.id);
    }
    if (query.courseId) {
      if (actor.role !== UserRole.LEARNER) {
        await this.coursesService.getManagedCourse(query.courseId, actor);
      }
      courseIds = courseIds ? courseIds.filter((id) => id === query.courseId) : [query.courseId];
    }
    let reports = await this.progressService.listForLearner(learnerId, courseIds);
    reports = this.filterByDate(reports, query);
    if (query.status) {
      reports = reports.filter((report) => report.enrollmentStatus === query.status);
    }
    return reports;
  }

  async courseEnrollments(actor: AuthUser, courseId: string, query: ReportQueryDto) {
    const course = await this.coursesService.getManagedCourse(courseId, actor);
    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.learner', 'learner')
      .where('enrollment.courseId = :courseId', { courseId: course.id })
      .orderBy('enrollment.enrolledAt', 'DESC');
    if (query.status) {
      qb.andWhere('enrollment.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('enrollment.enrolledAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('enrollment.enrolledAt <= :to', { to: query.to });
    }
    const enrollments = await qb.getMany();
    return {
      course: { id: course.id, title: course.title, status: course.status },
      total: enrollments.length,
      enrollments,
    };
  }

  async courseCompletion(actor: AuthUser, courseId: string, query: ReportQueryDto) {
    await this.coursesService.getManagedCourse(courseId, actor);
    const enrollments = await this.enrollmentsRepository.find({ where: { courseId } });
    let reports: ProgressReport[] = [];
    for (const enrollment of enrollments) {
      reports.push(await this.progressService.syncAndBuild(enrollment.id));
    }
    reports = this.filterByDate(reports, query);
    if (query.status) {
      reports = reports.filter((report) => report.enrollmentStatus === query.status);
    }
    const completed = reports.filter((report) => report.enrollmentStatus === 'COMPLETED').length;
    return {
      courseId,
      enrolled: reports.length,
      completed,
      active: reports.length - completed,
      averageCompletion: this.average(reports.map((report) => report.completionPercentage)),
      learners: reports,
    };
  }

  async quizPerformance(actor: AuthUser, quizId: string) {
    const quiz = await this.quizzesRepository.findOne({
      where: { id: quizId },
      relations: { course: true },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    if (actor.role === UserRole.LEARNER) {
      const attempts = await this.attemptsRepository.find({
        where: { quizId, learnerId: actor.id },
        order: { submittedAt: 'DESC' },
      });
      return this.summarizeQuiz(quiz, attempts);
    }
    await this.coursesService.getManagedCourse(quiz.courseId, actor);
    const attempts = await this.attemptsRepository.find({
      where: { quizId },
      relations: { learner: true },
      order: { submittedAt: 'DESC' },
    });
    return this.summarizeQuiz(quiz, attempts);
  }

  private summarizeQuiz(quiz: Quiz, attempts: QuizAttempt[]) {
    const passed = attempts.filter((attempt) => attempt.status === 'PASS').length;
    return {
      quiz: { id: quiz.id, title: quiz.title, courseId: quiz.courseId },
      attempts: attempts.length,
      passed,
      failed: attempts.length - passed,
      averagePercentage: this.average(attempts.map((attempt) => Number(attempt.percentage))),
      records: attempts,
    };
  }

  private filterByDate(reports: ProgressReport[], query: ReportQueryDto): ProgressReport[] {
    return reports.filter((report) => {
      const enrolled = new Date(report.enrolledAt).getTime();
      if (query.from && enrolled < new Date(query.from).getTime()) {
        return false;
      }
      if (query.to && enrolled > new Date(query.to).getTime()) {
        return false;
      }
      return true;
    });
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const total = values.reduce((sum, value) => sum + Number(value), 0);
    return Math.round((total / values.length) * 100) / 100;
  }
}
