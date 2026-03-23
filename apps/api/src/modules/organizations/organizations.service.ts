import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberStatus, OrganizationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(input: {
    name: string;
    type: OrganizationType;
    creatorUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          type: input.type,
          settings: {
            create: {
              settings: this.defaultSettingsForType(input.type) as Prisma.JsonObject
            }
          }
        }
      });

      const adminRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          key: 'ORGANIZATION_ADMIN',
          name: 'Organization Admin',
          description: 'Tenant-level administrator'
        }
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: input.creatorUserId,
          roleId: adminRole.id,
          status: MemberStatus.ACTIVE
        }
      });

      return organization;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: MemberStatus.ACTIVE },
      include: {
        organization: true,
        role: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getCurrentOrganization(input: { organizationId?: string; userId: string }) {
    if (!input.organizationId) {
      throw new BadRequestException('x-organization-id header is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId
        }
      },
      include: {
        organization: {
          include: {
            settings: true,
            subscription: true
          }
        },
        role: true
      }
    });

    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    if (membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Membership is not active');
    }

    return membership;
  }

  async listCurrentOrganizationMembers(input: { organizationId?: string; userId: string }) {
    if (!input.organizationId) {
      throw new BadRequestException('x-organization-id header is required');
    }

    await this.getCurrentOrganization({
      organizationId: input.organizationId,
      userId: input.userId
    });

    return this.prisma.organizationMember.findMany({
      where: {
        organizationId: input.organizationId,
        status: MemberStatus.ACTIVE
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  private defaultSettingsForType(type: OrganizationType): Record<string, unknown> {
    const base = {
      leaderboardEnabled: true,
      auditLogging: true
    };

    if (type === OrganizationType.PUBLISHER || type === OrganizationType.MEDIA_BRAND) {
      return {
        ...base,
        embedEnabled: true,
        leadFormsEnabled: true,
        schoolModeEnabled: false
      };
    }

    return {
      ...base,
      embedEnabled: false,
      leadFormsEnabled: false,
      schoolModeEnabled: true
    };
  }
}
