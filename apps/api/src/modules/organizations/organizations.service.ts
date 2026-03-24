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
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          type: input.type,
          settings: {
            create: {
              settings: this.defaultSettingsForType(input.type) as Prisma.JsonObject
            }
          },
          subscription: {
            create: {
              planCode: this.defaultPlanCodeForType(input.type),
              billingStatus: 'TRIALING',
              trialStartedAt,
              trialEndsAt
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

    return {
      ...membership,
      billing: this.toBillingState(membership.organization.subscription)
    };
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

  async getPlans() {
    return {
      trialDays: 30,
      products: [
        {
          productKey: 'SCHOOL',
          title: 'School Quiz Platform',
          plans: [
            { code: 'SCHOOL_STARTER', name: 'Starter', priceMonthly: 19, description: 'Small schools and pilot classrooms' },
            { code: 'SCHOOL_GROWTH', name: 'Growth', priceMonthly: 59, description: 'Growing schools with multiple classes' },
            { code: 'SCHOOL_PRO', name: 'Pro', priceMonthly: 129, description: 'Full school operations and analytics' }
          ]
        },
        {
          productKey: 'PUBLISHER',
          title: 'Publisher Engagement Platform',
          plans: [
            { code: 'PUBLISHER_STARTER', name: 'Starter', priceMonthly: 29, description: 'Low-volume engagement quizzes' },
            { code: 'PUBLISHER_GROWTH', name: 'Growth', priceMonthly: 99, description: 'Regular campaigns with lead forms' },
            { code: 'PUBLISHER_PRO', name: 'Pro', priceMonthly: 199, description: 'High-volume media and conversion analytics' }
          ]
        }
      ]
    };
  }

  async getCurrentBilling(input: { organizationId?: string; userId: string }) {
    const membership = await this.getCurrentOrganization(input);
    return {
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      planCode: membership.organization.subscription?.planCode ?? null,
      ...this.toBillingState(membership.organization.subscription)
    };
  }

  async activateCurrentBilling(input: { organizationId?: string; userId: string }) {
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
        role: true
      }
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }
    if (!membership.role?.key?.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId: input.organizationId }
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    const updated = await this.prisma.subscription.update({
      where: { organizationId: input.organizationId },
      data: {
        billingStatus: 'ACTIVE'
      }
    });

    return {
      organizationId: input.organizationId,
      planCode: updated.planCode,
      ...this.toBillingState(updated)
    };
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

  private defaultPlanCodeForType(type: OrganizationType): string {
    if (type === OrganizationType.PUBLISHER || type === OrganizationType.MEDIA_BRAND) {
      return 'PUBLISHER_GROWTH';
    }
    return 'SCHOOL_GROWTH';
  }

  private toBillingState(subscription: { billingStatus: string; trialEndsAt: Date | null } | null) {
    if (!subscription) {
      return {
        billingStatus: 'UNCONFIGURED',
        trialEndsAt: null,
        trialDaysLeft: 0,
        paymentRequired: true
      };
    }
    const trialEndsAt = subscription.trialEndsAt;
    const now = new Date();
    const diffMs = trialEndsAt ? trialEndsAt.getTime() - now.getTime() : 0;
    const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000))) : 0;
    const isTrialExpired = subscription.billingStatus === 'TRIALING' && trialEndsAt ? diffMs < 0 : false;
    return {
      billingStatus: isTrialExpired ? 'TRIAL_EXPIRED' : subscription.billingStatus,
      trialEndsAt,
      trialDaysLeft,
      paymentRequired: subscription.billingStatus !== 'ACTIVE' && (subscription.billingStatus !== 'TRIALING' || isTrialExpired)
    };
  }
}
