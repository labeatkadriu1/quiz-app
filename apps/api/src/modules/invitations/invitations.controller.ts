import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingGuard } from '../billing/billing.guard';
import { type InviteScope, InvitationsService } from './invitations.service';

class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsString()
  roleKey!: string;

  @IsIn(['ACTIVE_ORG', 'SPECIFIC_ORG', 'ALL_ADMIN_ORGS', 'ALL_SCHOOL_ORGS'])
  scope!: InviteScope;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  specificOrganizationId?: string;
}

class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, BillingGuard)
  create(
    @Body() body: CreateInvitationDto,
    @Headers('x-organization-id') activeOrganizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.invitationsService.createInvitations({
      inviterUserId: user.id,
      email: body.email,
      roleKey: body.roleKey,
      scope: body.scope,
      activeOrganizationId: body.organizationId ?? activeOrganizationId,
      specificOrganizationId: body.specificOrganizationId
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.invitationsService.listForOrganization({
      organizationId: organizationId ?? '',
      actorUserId: user.id
    });
  }

  @Post('accept')
  accept(@Body() body: AcceptInvitationDto) {
    return this.invitationsService.acceptInvitation({
      token: body.token,
      firstName: body.firstName,
      lastName: body.lastName,
      password: body.password
    });
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, BillingGuard)
  resend(
    @Param('id') invitationId: string,
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.invitationsService.resendInvitation({
      organizationId: organizationId ?? '',
      invitationId,
      actorUserId: user.id
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BillingGuard)
  remove(
    @Param('id') invitationId: string,
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.invitationsService.deleteInvitation({
      organizationId: organizationId ?? '',
      invitationId,
      actorUserId: user.id
    });
  }
}
