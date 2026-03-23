import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsEnum, IsString, MinLength } from 'class-validator';

enum OrganizationType {
  SCHOOL = 'SCHOOL',
  PUBLISHER = 'PUBLISHER',
  ACADEMY = 'ACADEMY',
  COMPANY = 'COMPANY',
  TRAINING_CENTER = 'TRAINING_CENTER',
  MEDIA_BRAND = 'MEDIA_BRAND'
}

class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;
}

@Controller('organizations')
export class OrganizationsController {
  @Post()
  create(@Body() body: CreateOrganizationDto): { message: string; payload: CreateOrganizationDto } {
    return { message: 'Organization persistence will be connected to Prisma next.', payload: body };
  }

  @Get('current')
  getCurrent(@Headers('x-organization-id') organizationId?: string): { organizationId?: string } {
    return { organizationId };
  }
}
