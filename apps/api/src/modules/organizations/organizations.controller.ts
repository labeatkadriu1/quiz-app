import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { OrganizationType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

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
      creatorUserId: user.id
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
}
