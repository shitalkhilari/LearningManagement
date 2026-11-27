import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments-query.dto';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Roles(UserRole.LEARNER)
  @ApiOperation({ summary: 'Enroll the current learner in a published course' })
  enroll(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.enroll(user, dto);
  }

  @Get('me')
  @Roles(UserRole.LEARNER)
  @ApiOperation({ summary: 'List courses the current learner is enrolled in' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.enrollmentsService.findMine(user);
  }

  @Get()
  @ApiOperation({ summary: 'List enrollments visible to the current role' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListEnrollmentsQueryDto) {
    return this.enrollmentsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one enrollment' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentsService.findOne(id, user);
  }
}
