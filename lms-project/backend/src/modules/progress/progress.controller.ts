import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('lessons/:lessonId/complete')
  @Roles(UserRole.LEARNER)
  @ApiOperation({ summary: 'Mark a lesson complete for the current learner' })
  complete(@CurrentUser() user: AuthUser, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.progressService.markLessonCompleted(user, lessonId);
  }

  @Get('me')
  @Roles(UserRole.LEARNER)
  @ApiOperation({ summary: 'Progress for every course the current learner is enrolled in' })
  mine(@CurrentUser() user: AuthUser) {
    return this.progressService.listMine(user);
  }

  @Get('enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Progress report for one enrollment' })
  byEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.progressService.getByEnrollment(user, enrollmentId);
  }
}
