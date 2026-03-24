import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AssignmentScopeType, JoinRequestStatus, QuestionType, QuizVisibility } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingGuard } from '../billing/billing.guard';
import { QuizzesService } from './quizzes.service';

class CreateQuizDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(QuizVisibility)
  visibility?: QuizVisibility;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attemptLimitDefault?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleAnswers?: boolean;

  @IsOptional()
  @IsString()
  contentType?: string;
}

class AnswerOptionDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

class AddQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  @MinLength(2)
  prompt!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsInt()
  @Min(1)
  position!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionDto)
  options?: AnswerOptionDto[];
}

class UpdateQuestionDto {
  @IsString()
  @MinLength(2)
  prompt!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionDto)
  options?: AnswerOptionDto[];
}

class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  questionIds!: string[];
}

class AssignmentTargetDto {
  @IsString()
  targetType!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

class CreateAssignmentDto {
  @IsEnum(AssignmentScopeType)
  scopeType!: AssignmentScopeType;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attemptLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passScoreOverride?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssignmentTargetDto)
  targets!: AssignmentTargetDto[];
}

class PublicAccessDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsIn(['PUBLIC_LINK', 'APPROVAL', 'PASSWORD'])
  mode?: 'PUBLIC_LINK' | 'APPROVAL' | 'PASSWORD';

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approvedEmails?: string[];
}

class EndFormFieldDto {
  @IsString()
  type!: string;

  @IsString()
  label!: string;

  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

class EndFormDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsBoolean()
  requireSubmit?: boolean;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  submitLabel?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndFormFieldDto)
  fields?: EndFormFieldDto[];
}

class QuizSettingsDto {
  @IsOptional()
  @IsIn(['STEP_BY_STEP', 'ALL_AT_ONCE'])
  questionFlowMode?: 'STEP_BY_STEP' | 'ALL_AT_ONCE';

  @IsOptional()
  @IsBoolean()
  showAnswerFeedback?: boolean;
}

class QuizThemeDto {
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  backgroundGradient?: string;

  @IsOptional()
  @IsString()
  cardColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;

  @IsOptional()
  @IsString()
  mutedTextColor?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  primaryTextColor?: string;

  @IsOptional()
  @IsString()
  correctColor?: string;

  @IsOptional()
  @IsString()
  wrongColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;
}

class StartScreenDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['DEFAULT', 'CUSTOM'])
  mode?: 'DEFAULT' | 'CUSTOM';

  @IsOptional()
  @IsBoolean()
  showGlassCard?: boolean;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  introHtml?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

class PredictorConfigDto {
  @IsOptional()
  @IsString()
  badgeText?: string;

  @IsOptional()
  @IsString()
  titleText?: string;

  @IsOptional()
  @IsString()
  leftTeamName?: string;

  @IsOptional()
  @IsString()
  rightTeamName?: string;

  @IsOptional()
  @IsString()
  leftTeamLogoUrl?: string;

  @IsOptional()
  @IsString()
  rightTeamLogoUrl?: string;

  @IsOptional()
  @IsInt()
  leftScore?: number;

  @IsOptional()
  @IsInt()
  rightScore?: number;

  @IsOptional()
  @IsInt()
  minScore?: number;

  @IsOptional()
  @IsInt()
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  step?: number;
}

class QuizContentTypeDto {
  @IsString()
  @IsIn(['QUIZ', 'FORM', 'POLL_SURVEY', 'MINIGAME', 'PERSONALITY_QUIZ', 'PREDICTOR', 'LEADERBOARD', 'STORY'])
  contentType!: string;
}

class ReviewAssignmentRequestDto {
  @IsOptional()
  @IsString()
  note?: string;
}

class EmbedSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowlistDomains?: string[];
}

class LeadWebhookDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  url?: string;
}

@Controller('quizzes')
@UseGuards(JwtAuthGuard, BillingGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  create(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Body() body: CreateQuizDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.createQuiz({
      organizationId: organizationId ?? '',
      ownerUserId: user.id,
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      passScore: body.passScore,
      timeLimitSeconds: body.timeLimitSeconds,
      attemptLimitDefault: body.attemptLimitDefault,
      shuffleQuestions: body.shuffleQuestions,
      shuffleAnswers: body.shuffleAnswers,
      contentType: body.contentType
    });
  }

  @Get()
  list(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.listQuizzesForOrg({
      organizationId: organizationId ?? '',
      actorUserId: user.id
    });
  }

  @Get(':id/attempts')
  listAttempts(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.listQuizAttemptsDetailed({
      organizationId: organizationId ?? '',
      quizId,
      actorUserId: user.id
    });
  }

  @Patch(':id/settings')
  configureSettings(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: QuizSettingsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureQuizSettings({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      questionFlowMode: body.questionFlowMode,
      showAnswerFeedback: body.showAnswerFeedback
    });
  }

  @Get(':id/settings')
  getSettings(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getQuizSettings({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Patch(':id/theme')
  configureTheme(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: QuizThemeDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureQuizTheme({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      theme: body
    });
  }

  @Patch(':id/content-type')
  configureContentType(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: QuizContentTypeDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureContentType({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      contentType: body.contentType
    });
  }

  @Patch(':id/predictor-config')
  configurePredictorConfig(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: PredictorConfigDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configurePredictorConfig({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      config: body
    });
  }

  @Get(':id/predictor-config')
  getPredictorConfig(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getPredictorConfig({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Get(':id/theme')
  getTheme(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getQuizTheme({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Patch(':id/start-screen')
  configureStartScreen(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: StartScreenDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureStartScreen({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      config: body
    });
  }

  @Get(':id/start-screen')
  getStartScreen(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getStartScreen({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Post(':id/questions')
  addQuestion(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: AddQuestionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.addQuestion({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      type: body.type,
      prompt: body.prompt,
      explanation: body.explanation,
      imageUrl: body.imageUrl,
      points: body.points,
      position: body.position,
      options: body.options
    });
  }

  @Patch('questions/:questionId')
  updateQuestion(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('questionId') questionId: string,
    @Body() body: UpdateQuestionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.updateQuestion({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      questionId,
      prompt: body.prompt,
      explanation: body.explanation,
      imageUrl: body.imageUrl,
      points: body.points,
      options: body.options
    });
  }

  @Delete(':id')
  deleteQuiz(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.deleteQuiz({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Delete('questions/:questionId')
  deleteQuestion(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.deleteQuestion({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      questionId
    });
  }

  @Post(':id/questions/reorder')
  reorderQuestions(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: ReorderQuestionsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.reorderQuestions({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      questionIds: body.questionIds
    });
  }

  @Post(':id/publish')
  publish(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.publishQuiz({
      organizationId: organizationId ?? '',
      quizId,
      actorUserId: user.id
    });
  }

  @Post(':id/assignments')
  createAssignment(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.createAssignment({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      scopeType: body.scopeType,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      attemptLimit: body.attemptLimit,
      passScoreOverride: body.passScoreOverride,
      targets: body.targets
    });
  }

  @Get(':id/assignments')
  listAssignments(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.listAssignmentsForQuiz({
      organizationId: organizationId ?? '',
      quizId,
      actorUserId: user.id
    });
  }

  @Get(':id/assignments/:assignmentId/requests')
  listAssignmentRequests(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.listAssignmentRequests({
      organizationId: organizationId ?? '',
      quizId,
      assignmentId,
      actorUserId: user.id
    });
  }

  @Get('assignment-requests/inbox')
  listAssignmentRequestsInbox(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status: JoinRequestStatus | undefined
  ) {
    return this.quizzesService.listAssignmentRequestsInbox({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      status
    });
  }

  @Post(':id/assignments/:assignmentId/requests/:requestId/approve')
  approveAssignmentRequest(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('requestId') requestId: string,
    @Body() body: ReviewAssignmentRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.reviewAssignmentRequest({
      organizationId: organizationId ?? '',
      quizId,
      assignmentId,
      requestId,
      actorUserId: user.id,
      action: 'APPROVE',
      note: body.note
    });
  }

  @Post(':id/assignments/:assignmentId/requests/:requestId/reject')
  rejectAssignmentRequest(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('requestId') requestId: string,
    @Body() body: ReviewAssignmentRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.reviewAssignmentRequest({
      organizationId: organizationId ?? '',
      quizId,
      assignmentId,
      requestId,
      actorUserId: user.id,
      action: 'REJECT',
      note: body.note
    });
  }

  @Patch(':id/public-access')
  configurePublicAccess(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: PublicAccessDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configurePublicAccess({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      enabled: body.enabled,
      mode: body.mode,
      password: body.password,
      approvedEmails: body.approvedEmails
    });
  }

  @Get(':id/public-access')
  getPublicAccess(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getPublicAccessSettings({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Patch(':id/end-form')
  configureEndForm(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: EndFormDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureEndForm({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      enabled: body.enabled,
      requireSubmit: body.requireSubmit,
      title: body.title,
      description: body.description,
      submitLabel: body.submitLabel,
      fields: body.fields
    });
  }

  @Get(':id/end-form')
  getEndForm(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getEndForm({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Get(':id/end-form/submissions')
  listEndFormSubmissions(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.listEndFormSubmissions({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Get(':id/end-form/submissions/export')
  exportEndFormSubmissions(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.exportEndFormSubmissionsCsv({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Patch(':id/embed-settings')
  configureEmbedSettings(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: EmbedSettingsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureEmbedSettings({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      enabled: body.enabled,
      allowlistDomains: body.allowlistDomains
    });
  }

  @Get(':id/embed-settings')
  getEmbedSettings(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getEmbedSettings({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Patch(':id/lead-webhook')
  configureLeadWebhook(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @Body() body: LeadWebhookDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.configureLeadWebhook({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId,
      enabled: body.enabled,
      url: body.url
    });
  }

  @Get(':id/lead-webhook')
  getLeadWebhook(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getLeadWebhook({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }

  @Get(':id/funnel')
  getQuizFunnel(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.quizzesService.getQuizFunnel({
      organizationId: organizationId ?? '',
      actorUserId: user.id,
      quizId
    });
  }
}
