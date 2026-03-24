import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberStatus, OrganizationType, Prisma, type RedeemCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getBillingGuardState, limitsForPlan } from './plan-limits';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(input: {
    name: string;
    type: OrganizationType;
    planCode?: string;
    redeemCode?: string;
    creatorUserId: string;
    creatorEmail: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const selectedPlanCode = this.resolvePlanCodeForType(input.type, input.planCode);
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
              planCode: selectedPlanCode,
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

      const redeemResult = await this.applyRedeemCodeIfProvided(tx, {
        organizationId: organization.id,
        organizationType: input.type,
        actorUserId: input.creatorUserId,
        actorEmail: input.creatorEmail,
        code: input.redeemCode
      });

      return {
        ...organization,
        redeemCodeApplied: redeemResult
      };
    });
  }

  async validateRedeemCode(input: { code: string; type: OrganizationType; actorUserId: string }) {
    if (!input.actorUserId) {
      throw new BadRequestException('Authenticated user is required');
    }
    const normalizedCode = input.code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('Redeem code is required');
    }

    const redeemCode = await this.prisma.redeemCode.findUnique({
      where: { code: normalizedCode }
    });
    this.assertRedeemCodeUsable({
      redeemCode,
      organizationId: null
    });

    return {
      valid: true,
      code: normalizedCode,
      type: redeemCode!.type,
      percentOff: redeemCode!.percentOff ?? null,
      freePeriodDays: redeemCode!.freePeriodDays ?? null,
      maxPerClient: redeemCode!.maxPerClient,
      newSignupsOnly: redeemCode!.newSignupsOnly,
      validUntil: redeemCode!.validUntil
    };
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
            {
              code: 'SCHOOL_STARTER',
              name: 'Starter',
              priceMonthly: 19,
              description: 'Small schools and pilot classrooms',
              limits: limitsForPlan('SCHOOL_STARTER')
            },
            {
              code: 'SCHOOL_GROWTH',
              name: 'Growth',
              priceMonthly: 59,
              description: 'Growing schools with multiple classes',
              limits: limitsForPlan('SCHOOL_GROWTH')
            },
            {
              code: 'SCHOOL_PRO',
              name: 'Pro',
              priceMonthly: 129,
              description: 'Full school operations and analytics',
              limits: limitsForPlan('SCHOOL_PRO')
            }
          ]
        },
        {
          productKey: 'PUBLISHER',
          title: 'Publisher Engagement Platform',
          plans: [
            {
              code: 'PUBLISHER_STARTER',
              name: 'Starter',
              priceMonthly: 29,
              description: 'Low-volume engagement quizzes',
              limits: limitsForPlan('PUBLISHER_STARTER')
            },
            {
              code: 'PUBLISHER_GROWTH',
              name: 'Growth',
              priceMonthly: 99,
              description: 'Regular campaigns with lead forms',
              limits: limitsForPlan('PUBLISHER_GROWTH')
            },
            {
              code: 'PUBLISHER_PRO',
              name: 'Pro',
              priceMonthly: 199,
              description: 'High-volume media and conversion analytics',
              limits: limitsForPlan('PUBLISHER_PRO')
            }
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

  async getCurrentLimits(input: { organizationId?: string; userId: string }) {
    if (!input.organizationId) {
      throw new BadRequestException('x-organization-id header is required');
    }
    await this.getCurrentOrganization(input);

    const [billing, memberCount, quizCount, attemptCount] = await Promise.all([
      getBillingGuardState(this.prisma, input.organizationId),
      this.prisma.organizationMember.count({
        where: {
          organizationId: input.organizationId,
          status: MemberStatus.ACTIVE
        }
      }),
      this.prisma.quiz.count({
        where: {
          organizationId: input.organizationId
        }
      }),
      this.prisma.quizAttempt.count({
        where: {
          organizationId: input.organizationId,
          createdAt: {
            gte: this.monthStart()
          }
        }
      })
    ]);

    return {
      organizationId: input.organizationId,
      planCode: billing.planCode,
      billingStatus: billing.billingStatus,
      paymentRequired: billing.paymentRequired,
      limits: billing.limits,
      usage: {
        members: memberCount,
        quizzes: quizCount,
        monthlyAttempts: attemptCount
      },
      remaining: {
        members: Math.max(0, billing.limits.memberLimit - memberCount),
        quizzes: Math.max(0, billing.limits.quizLimit - quizCount),
        monthlyAttempts: Math.max(0, billing.limits.monthlyAttemptLimit - attemptCount)
      }
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

  private resolvePlanCodeForType(type: OrganizationType, requestedPlanCode?: string): string {
    const normalized = requestedPlanCode?.trim().toUpperCase() ?? '';
    const schoolPlans = new Set(['SCHOOL_STARTER', 'SCHOOL_GROWTH', 'SCHOOL_PRO']);
    const publisherPlans = new Set(['PUBLISHER_STARTER', 'PUBLISHER_GROWTH', 'PUBLISHER_PRO']);
    const isPublisherType = type === OrganizationType.PUBLISHER || type === OrganizationType.MEDIA_BRAND;

    if (!normalized) {
      return this.defaultPlanCodeForType(type);
    }
    if (isPublisherType && publisherPlans.has(normalized)) {
      return normalized;
    }
    if (!isPublisherType && schoolPlans.has(normalized)) {
      return normalized;
    }

    throw new BadRequestException(
      isPublisherType
        ? 'Selected plan is not valid for publisher/media organizations'
        : 'Selected plan is not valid for school/company/academy organizations'
    );
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

  private monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private async applyRedeemCodeIfProvided(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      organizationType: OrganizationType;
      actorUserId: string;
      actorEmail: string;
      code?: string;
    }
  ) {
    const code = input.code?.trim().toUpperCase();
    if (!code) {
      return null;
    }

    const redeemCode = await tx.redeemCode.findUnique({
      where: { code }
    });

    this.assertRedeemCodeUsable({
      redeemCode,
      organizationId: input.organizationId
    });

    const totalUsages = await tx.redeemCodeUsage.count({
      where: {
        redeemCodeId: redeemCode!.id
      }
    });
    if (redeemCode!.maxRedemptions !== null && totalUsages >= redeemCode!.maxRedemptions) {
      throw new BadRequestException('Redeem code has reached its total usage limit');
    }

    const organizationUsages = await tx.redeemCodeUsage.count({
      where: {
        redeemCodeId: redeemCode!.id,
        organizationId: input.organizationId
      }
    });
    if (organizationUsages >= redeemCode!.maxPerClient) {
      throw new BadRequestException('Redeem code has already been used for this client');
    }

    const updateSubscriptionData: Prisma.SubscriptionUpdateInput = {};
    if (redeemCode!.type === 'FREE_PERIOD') {
      const freePeriodDays = redeemCode!.freePeriodDays ?? 0;
      if (freePeriodDays <= 0) {
        throw new BadRequestException('Redeem code free period is not configured');
      }
      const subscription = await tx.subscription.findUnique({
        where: { organizationId: input.organizationId }
      });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }
      const now = Date.now();
      const baseMs =
        subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now
          ? subscription.trialEndsAt.getTime()
          : now;
      updateSubscriptionData.trialEndsAt = new Date(baseMs + freePeriodDays * 24 * 60 * 60 * 1000);
      if (subscription.billingStatus !== 'ACTIVE') {
        updateSubscriptionData.billingStatus = 'TRIALING';
      }
    }

    if (Object.keys(updateSubscriptionData).length > 0) {
      await tx.subscription.update({
        where: { organizationId: input.organizationId },
        data: updateSubscriptionData
      });
    }

    await tx.redeemCodeUsage.create({
      data: {
        redeemCodeId: redeemCode!.id,
        organizationId: input.organizationId,
        appliedByUserId: input.actorUserId,
        discountPercentApplied: redeemCode!.type === 'PERCENT' ? redeemCode!.percentOff ?? null : null,
        freePeriodDaysApplied: redeemCode!.type === 'FREE_PERIOD' ? redeemCode!.freePeriodDays ?? null : null,
        metadata: {
          actorEmail: input.actorEmail,
          source: 'ORGANIZATION_CREATE'
        }
      }
    });

    await tx.redeemCode.update({
      where: { id: redeemCode!.id },
      data: {
        redemptionCount: {
          increment: 1
        }
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'REDEEM_CODE_APPLIED',
        resourceType: 'REDEEM_CODE',
        resourceId: redeemCode!.id,
        payload: {
          code: redeemCode!.code,
          type: redeemCode!.type,
          percentOff: redeemCode!.percentOff ?? null,
          freePeriodDays: redeemCode!.freePeriodDays ?? null
        }
      }
    });

    return {
      code: redeemCode!.code,
      type: redeemCode!.type,
      percentOff: redeemCode!.percentOff ?? null,
      freePeriodDays: redeemCode!.freePeriodDays ?? null
    };
  }

  private assertRedeemCodeUsable(input: {
    redeemCode: RedeemCode | null;
    organizationId: string | null;
  }): void {
    const redeemCode = input.redeemCode;
    if (!redeemCode || !redeemCode.active) {
      throw new BadRequestException('Redeem code is invalid or inactive');
    }

    const now = Date.now();
    if (redeemCode.validFrom && redeemCode.validFrom.getTime() > now) {
      throw new BadRequestException('Redeem code is not active yet');
    }
    if (redeemCode.validUntil && redeemCode.validUntil.getTime() < now) {
      throw new BadRequestException('Redeem code has expired');
    }
    if (redeemCode.organizationId && input.organizationId && redeemCode.organizationId !== input.organizationId) {
      throw new BadRequestException('Redeem code is not valid for this client');
    }

    if (redeemCode.type === 'PERCENT') {
      const value = redeemCode.percentOff ?? 0;
      if (value <= 0 || value > 100) {
        throw new BadRequestException('Redeem code percent discount is invalid');
      }
    }
    if (redeemCode.type === 'FREE_PERIOD') {
      const days = redeemCode.freePeriodDays ?? 0;
      if (days <= 0) {
        throw new BadRequestException('Redeem code free period is invalid');
      }
    }
  }
}
