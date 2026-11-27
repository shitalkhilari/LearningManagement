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
import { AssessmentsService } from './assessments.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@ApiTags('Assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('courses/:courseId/quizzes')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Create a quiz for a course' })
  createQuiz(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateQuizDto,
  ) {
    return this.assessmentsService.createQuiz(courseId, user, dto);
  }

  @Get('courses/:courseId/quizzes')
  @ApiOperation({ summary: 'List quizzes for a course. Learners do not see correct answers.' })
  listByCourse(@CurrentUser() user: AuthUser, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.assessmentsService.listByCourse(courseId, user);
  }

  @Get('quizzes/:id')
  @ApiOperation({ summary: 'Get a quiz. Correct options are hidden from learners.' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.findOne(id, user);
  }

  @Patch('quizzes/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Update quiz details' })
  updateQuiz(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.assessmentsService.updateQuiz(id, user, dto);
  }

  @Delete('quizzes/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Delete a quiz that has no attempts' })
  removeQuiz(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.removeQuiz(id, user);
  }

  @Post('quizzes/:quizId/questions')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Add a question with options. Exactly one option must be correct.' })
  addQuestion(
    @CurrentUser() user: AuthUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.assessmentsService.addQuestion(quizId, user, dto);
  }

  @Patch('questions/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Update a question and optionally replace its options' })
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.assessmentsService.updateQuestion(id, user, dto);
  }

  @Delete('questions/:id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Delete a question that has no responses' })
  removeQuestion(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.removeQuestion(id, user);
  }

  @Post('quizzes/:quizId/submit')
  @Roles(UserRole.LEARNER)
  @ApiOperation({ summary: 'Submit quiz answers. The score is calculated on the server.' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.assessmentsService.submit(quizId, user, dto);
  }

  @Get('quizzes/:quizId/attempts')
  @ApiOperation({ summary: 'List quiz attempts visible to the current role' })
  listAttempts(@CurrentUser() user: AuthUser, @Param('quizId', ParseUUIDPipe) quizId: string) {
    return this.assessmentsService.listAttempts(quizId, user);
  }

  @Get('attempts/:id')
  @ApiOperation({ summary: 'Get one quiz attempt and the stored responses' })
  findAttempt(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.findAttempt(id, user);
  }
}
