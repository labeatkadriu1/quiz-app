import { Body, Controller, Get, Headers, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsEmail, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
}

class PublicEndFormDto {
  @IsObject()
  values!: Record<string, unknown>;
}

@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('quizzes/:id/attempts/start')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
      email: body.email
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
  submitPublic(@Param('id') attemptId: string) {
    return this.attemptsService.submitPublicAttempt({
      attemptId
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
  getPublicQuiz(@Param('id') quizId: string, @Query('token') token: string | undefined) {
    return this.attemptsService.getPublicQuiz({
      quizId,
      token: token ?? ''
    });
  }
}
