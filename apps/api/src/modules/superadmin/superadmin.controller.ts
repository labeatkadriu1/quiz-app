import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminService } from './superadmin.service';

class SetFreeAccessDto {
  @IsBoolean()
  enabled!: boolean;
}

class ExtendTrialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days!: number;
}

class ListClientsQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  billingStatus?: string;

  @IsOptional()
  @IsString()
  planCode?: string;
}

class CreateRedeemCodeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  type!: 'PERCENT' | 'FREE_PERIOD';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  freePeriodDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxRedemptions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxPerClient?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  newSignupsOnly?: boolean;
}

@Controller('superadmin')
@UseGuards(JwtAuthGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('clients')
  listClients(@CurrentUser() user: AuthenticatedUser, @Query() query: ListClientsQuery) {
    return this.superadminService.listClients({
      actorEmail: user.email,
      query: query.q,
      status: query.status,
      billingStatus: query.billingStatus,
      planCode: query.planCode
    });
  }

  @Get('clients/:organizationId/details')
  details(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.superadminService.getClientDetails({
      actorEmail: user.email,
      organizationId
    });
  }

  @Patch('clients/:organizationId/free-access')
  setFreeAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() body: SetFreeAccessDto
  ) {
    return this.superadminService.setClientFreeAccess({
      actorEmail: user.email,
      actorUserId: user.id,
      organizationId,
      enabled: body.enabled
    });
  }

  @Patch('clients/:organizationId/extend-trial')
  extendTrial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() body: ExtendTrialDto
  ) {
    return this.superadminService.extendClientTrial({
      actorEmail: user.email,
      actorUserId: user.id,
      organizationId,
      days: body.days
    });
  }

  @Post('clients/:organizationId/grant-free-period')
  grantFreePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() body: ExtendTrialDto
  ) {
    return this.superadminService.grantClientFreePeriod({
      actorEmail: user.email,
      actorUserId: user.id,
      organizationId,
      days: body.days
    });
  }

  @Get('clients/:organizationId/redeem-codes')
  listClientRedeemCodes(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.superadminService.listRedeemCodes({
      actorEmail: user.email,
      organizationId
    });
  }

  @Post('clients/:organizationId/redeem-codes')
  createClientRedeemCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateRedeemCodeDto
  ) {
    return this.superadminService.createRedeemCode({
      actorEmail: user.email,
      actorUserId: user.id,
      organizationId,
      ...body
    });
  }

  @Delete('clients/:organizationId/redeem-codes/:code')
  disableClientRedeemCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('code') code: string
  ) {
    return this.superadminService.disableRedeemCode({
      actorEmail: user.email,
      organizationId,
      code
    });
  }

  @Get('redeem-codes')
  listGlobalRedeemCodes(@CurrentUser() user: AuthenticatedUser) {
    return this.superadminService.listRedeemCodes({
      actorEmail: user.email,
      organizationId: null
    });
  }

  @Post('redeem-codes')
  createGlobalRedeemCode(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRedeemCodeDto) {
    return this.superadminService.createRedeemCode({
      actorEmail: user.email,
      actorUserId: user.id,
      organizationId: null,
      ...body
    });
  }

  @Delete('redeem-codes/:code')
  disableGlobalRedeemCode(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.superadminService.disableRedeemCode({
      actorEmail: user.email,
      organizationId: null,
      code
    });
  }
}
