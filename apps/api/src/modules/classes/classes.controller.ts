import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ClassMemberType, JoinRequestStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingGuard } from '../billing/billing.guard';
import { ClassesService } from './classes.service';

class CreateClassDto {
  @IsUUID()
  schoolId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;
}

class AddClassMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(ClassMemberType)
  memberType!: ClassMemberType;
}

class CreateSchoolDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

class CreateJoinLinkDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class PublicJoinRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class ReviewJoinRequestDto {
  @IsBoolean()
  approve!: boolean;
}

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, BillingGuard)
  create(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Body() body: CreateClassDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.createClass({
      organizationId: organizationId ?? '',
      schoolId: body.schoolId,
      name: body.name,
      code: body.code,
      gradeLevel: body.gradeLevel,
      actorUserId: user.id
    });
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard, BillingGuard)
  addMember(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') classId: string,
    @Body() body: AddClassMemberDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.addMember({
      organizationId: organizationId ?? '',
      classId: classId ?? '',
      userId: body.userId,
      memberType: body.memberType,
      actorUserId: user.id
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, BillingGuard)
  list(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.listForOrganization({
      organizationId: organizationId ?? '',
      actorUserId: user.id
    });
  }

  @Get('schools')
  @UseGuards(JwtAuthGuard, BillingGuard)
  listSchools(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.listSchools({
      organizationId: organizationId ?? '',
      actorUserId: user.id
    });
  }

  @Post('schools')
  @UseGuards(JwtAuthGuard, BillingGuard)
  createSchool(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Body() body: CreateSchoolDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.createSchool({
      organizationId: organizationId ?? '',
      name: body.name,
      timezone: body.timezone,
      actorUserId: user.id
    });
  }

  @Post(':id/join-links')
  @UseGuards(JwtAuthGuard, BillingGuard)
  createJoinLink(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') classId: string,
    @Body() body: CreateJoinLinkDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.createJoinLink({
      organizationId: organizationId ?? '',
      classId,
      actorUserId: user.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
    });
  }

  @Get(':id/join-requests')
  @UseGuards(JwtAuthGuard, BillingGuard)
  listJoinRequests(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') classId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status: JoinRequestStatus | undefined
  ) {
    return this.classesService.listJoinRequests({
      organizationId: organizationId ?? '',
      classId,
      actorUserId: user.id,
      status
    });
  }

  @Post('join-requests/:id/review')
  @UseGuards(JwtAuthGuard, BillingGuard)
  reviewJoinRequest(
    @Headers('x-organization-id') organizationId: string | undefined,
    @Param('id') requestId: string,
    @Body() body: ReviewJoinRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.classesService.reviewJoinRequest({
      organizationId: organizationId ?? '',
      requestId,
      actorUserId: user.id,
      approve: body.approve
    });
  }

  @Get('public/join/:token')
  joinLinkPublic(@Param('token') token: string) {
    return this.classesService.getJoinLinkPublic({ token });
  }

  @Post('public/join/:token/request')
  requestJoinPublic(@Param('token') token: string, @Body() body: PublicJoinRequestDto) {
    return this.classesService.requestJoinByLink({
      token,
      email: body.email,
      note: body.note
    });
  }
}
