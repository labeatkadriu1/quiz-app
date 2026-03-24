import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { OrganizationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @IsString()
  redeemCode?: string;
}

class ValidateRedeemCodeDto {
  @IsString()
  code!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() body: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.createOrganization({
      name: body.name,
      type: body.type,
      planCode: body.planCode,
      redeemCode: body.redeemCode,
      creatorUserId: user.id,
      creatorEmail: user.email
    });
  }

  @Post('redeem-codes/validate')
  validateRedeemCode(@Body() body: ValidateRedeemCodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.validateRedeemCode({
      code: body.code,
      type: body.type,
      actorUserId: user.id
    });
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.id);
  }

  @Get('current')
  getCurrent(@Headers('x-organization-id') organizationId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getCurrentOrganization({
      organizationId,
      userId: user.id
    });
  }

  @Get('current/members')
  listCurrentMembers(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.listCurrentOrganizationMembers({
      organizationId,
      userId: user.id
    });
  }

  @Get('plans')
  plans() {
    return this.organizationsService.getPlans();
  }

  @Get('current/billing')
  getCurrentBilling(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.getCurrentBilling({
      organizationId,
      userId: user.id
    });
  }

  @Get('current/limits')
  getCurrentLimits(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.getCurrentLimits({
      organizationId,
      userId: user.id
    });
  }

  @Post('current/billing/activate')
  activateCurrentBilling(
    @Headers('x-organization-id') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.activateCurrentBilling({
      organizationId,
      userId: user.id
    });
  }
}
