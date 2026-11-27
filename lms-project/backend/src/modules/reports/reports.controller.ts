import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard counts for the current role' })
  overview(@CurrentUser() user: AuthUser) {
    return this.reportsService.overview(user);
  }

  @Get('learners/:learnerId/progress')
  @ApiOperation({ summary: 'Individual learner progress report' })
  learnerProgress(
    @CurrentUser() user: AuthUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.learnerProgress(user, learnerId, query);
  }

  @Get('courses/:courseId/enrollments')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Course-wise enrollment report' })
  courseEnrollments(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.courseEnrollments(user, courseId, query);
  }

  @Get('courses/:courseId/completion')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Course completion report' })
  courseCompletion(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.courseCompletion(user, courseId, query);
  }

  @Get('quizzes/:quizId/performance')
  @ApiOperation({ summary: 'Quiz performance report' })
  quizPerformance(@CurrentUser() user: AuthUser, @Param('quizId', ParseUUIDPipe) quizId: string) {
    return this.reportsService.quizPerformance(user, quizId);
  }
}
