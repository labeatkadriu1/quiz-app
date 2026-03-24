import { Body, Controller, Get, Headers, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsEmail, IsInt, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingGuard } from '../billing/billing.guard';
import { AttemptsService } from './attempts.service';

class SaveAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsObject()
  answerPayload!: Record<string, unknown>;
}

class SaveAnswersWrapperDto {
  @ValidateNested()
  @Type(() => SaveAnswerDto)
  answer!: SaveAnswerDto;
}

class PublicStartDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  sourceDomain?: string;
}

class PublicEndFormDto {
  @IsObject()
  values!: Record<string, unknown>;
}

class PublicPredictorDto {
  @IsInt()
  leftScore!: number;

  @IsInt()
  rightScore!: number;

  @IsOptional()
  @IsString()
  leftTeamName?: string;

  @IsOptional()
  @IsString()
  rightTeamName?: string;
}

class PublicSubmitDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicPredictorDto)
  predictor?: PublicPredictorDto;
}

class PublicAssignmentRequestDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('quizzes/:id/attempts/start')
  @UseGuards(JwtAuthGuard, BillingGuard)
  start(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') quizId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attemptsService.startAttempt({
      organizationId: organizationId ?? '',
      quizId,
      userId: user.id
    });
  }

  @Put('attempts/:id/answers')
  @UseGuards(JwtAuthGuard, BillingGuard)
  saveAnswer(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') attemptId: string,
    @Body() body: SaveAnswersWrapperDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attemptsService.saveAnswer({
      organizationId: organizationId ?? '',
      attemptId,
      userId: user.id,
      answer: body.answer
    });
  }

  @Post('attempts/:id/submit')
  @UseGuards(JwtAuthGuard, BillingGuard)
  submit(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') attemptId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attemptsService.submitAttempt({
      organizationId: organizationId ?? '',
      attemptId,
      userId: user.id
    });
  }

  @Get('attempts/:id/result')
  @UseGuards(JwtAuthGuard, BillingGuard)
  result(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') attemptId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attemptsService.getResult({
      organizationId: organizationId ?? '',
      attemptId,
      userId: user.id
    });
  }

  @Post('public/quizzes/:id/attempts/start')
  startPublic(@Param('id') quizId: string, @Body() body: PublicStartDto) {
    return this.attemptsService.startPublicAttempt({
      quizId,
      token: body.token,
      password: body.password,
      email: body.email,
      sourceDomain: body.sourceDomain
    });
  }

  @Put('public/attempts/:id/answers')
  savePublicAnswer(@Param('id') attemptId: string, @Body() body: SaveAnswersWrapperDto) {
    return this.attemptsService.savePublicAnswer({
      attemptId,
      answer: body.answer
    });
  }

  @Post('public/attempts/:id/submit')
  submitPublic(@Param('id') attemptId: string, @Body() body: PublicSubmitDto) {
    return this.attemptsService.submitPublicAttempt({
      attemptId,
      predictor: body.predictor
    });
  }

  @Get('public/attempts/:id/result')
  publicResult(@Param('id') attemptId: string) {
    return this.attemptsService.getPublicResult({
      attemptId
    });
  }

  @Post('public/attempts/:id/end-form')
  submitPublicEndForm(@Param('id') attemptId: string, @Body() body: PublicEndFormDto) {
    return this.attemptsService.submitPublicEndForm({
      attemptId,
      values: body.values
    });
  }

  @Get('public/quizzes/:id')
  getPublicQuiz(
    @Param('id') quizId: string,
    @Query('token') token: string | undefined,
    @Query('source') sourceDomain: string | undefined
  ) {
    return this.attemptsService.getPublicQuiz({
      quizId,
      token: token ?? '',
      sourceDomain
    });
  }

  @Get('public/assignments/request-link/:token')
  getPublicAssignmentRequestContext(@Param('token') token: string) {
    return this.attemptsService.getPublicAssignmentRequestContext({ token });
  }

  @Post('public/assignments/request-link/:token/request')
  submitPublicAssignmentRequest(
    @Param('token') token: string,
    @Body() body: PublicAssignmentRequestDto
  ) {
    return this.attemptsService.submitPublicAssignmentRequest({
      token,
      name: body.name,
      email: body.email
    });
  }
}
