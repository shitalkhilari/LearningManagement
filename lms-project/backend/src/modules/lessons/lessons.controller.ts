import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';

@ApiTags('Lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('modules/:moduleId/lessons')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Add a lesson to a module' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(moduleId, user, dto);
  }

  @Get('modules/:moduleId/lessons')
  @ApiOperation({ summary: 'List lessons in a module. Learners must be enrolled.' })
  findByModule(@CurrentUser() user: AuthUser, @Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.lessonsService.findByModule(moduleId, user);
  }

  @Patch('modules/:moduleId/lessons/reorder')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Reorder all lessons in a module' })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(moduleId, user, dto.orderedIds);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get one lesson. Learners must be enrolled in a published course.' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.findOne(id, user);
  }

  @Patch('lessons/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Update a lesson' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, user, dto);
  }

  @Delete('lessons/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Delete a lesson that has no progress records' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.remove(id, user);
  }
}
