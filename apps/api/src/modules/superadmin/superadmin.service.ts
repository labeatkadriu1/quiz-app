import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberStatus, Prisma, type OrganizationType, type RedeemCode } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SUPERADMIN_EMAIL = 'kadriu84@gmail.com';

@Injectable()
export class SuperadminService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(input: {
    actorEmail: string;
    query?: string;
    status?: string;
    billingStatus?: string;
    planCode?: string;
  }) {
    this.assertSuperAdmin(input.actorEmail);

    const query = input.query?.trim();
    const status = input.status?.trim().toUpperCase();
    const billingStatus = input.billingStatus?.trim().toUpperCase();
    const planCode = input.planCode?.trim().toUpperCase();

    let organizations: Array<any> = [];
    let redeemFeaturesAvailable = true;
    try {
      organizations = await this.prisma.organization.findMany({
        where: {
          ...(query
            ? {
                OR: [{ name: { contains: query, mode: 'insensitive' } }, { id: { equals: query } }]
              }
            : {}),
          ...(status ? { status: status as never } : {}),
          ...(billingStatus || planCode
            ? {
                subscription: {
                  ...(billingStatus ? { billingStatus } : {}),
                  ...(planCode ? { planCode } : {})
                }
              }
            : {})
        },
        include: {
          subscription: true,
          redeemCodes: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          },
          members: {
            where: {
              status: MemberStatus.ACTIVE,
              role: {
                key: {
                  contains: 'ADMIN'
                }
              }
            },
            include: {
              user: {
                select: {
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true,
              quizzes: true,
              classes: true,
              redeemCodes: true,
              redeemCodeUsages: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      if (!this.isRedeemTableUnavailableError(error)) {
        throw error;
      }
      redeemFeaturesAvailable = false;
      organizations = await this.prisma.organization.findMany({
        where: {
          ...(query
            ? {
                OR: [{ name: { contains: query, mode: 'insensitive' } }, { id: { equals: query } }]
              }
            : {}),
          ...(status ? { status: status as never } : {}),
          ...(billingStatus || planCode
            ? {
                subscription: {
                  ...(billingStatus ? { billingStatus } : {}),
                  ...(planCode ? { planCode } : {})
                }
              }
            : {})
        },
        include: {
          subscription: true,
          members: {
            where: {
              status: MemberStatus.ACTIVE,
              role: {
                key: {
                  contains: 'ADMIN'
                }
              }
            },
            include: {
              user: {
                select: {
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true,
              quizzes: true,
              classes: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }

    return organizations.map((org) => {
      const trialEndsAt = org.subscription?.trialEndsAt ?? null;
      const daysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0;
      const adminEmails = Array.from(
        new Set(
          org.members
            .map((member: { user?: { email?: string | null } | null }) => member.user?.email?.toLowerCase())
            .filter((email: string | undefined): email is string => Boolean(email))
        )
      );

      return {
        id: org.id,
        name: org.name,
        type: org.type,
        status: org.status,
        createdAt: org.createdAt,
        subscription: org.subscription
          ? {
              planCode: org.subscription.planCode,
              billingStatus: org.subscription.billingStatus,
              trialStartedAt: org.subscription.trialStartedAt,
              trialEndsAt: org.subscription.trialEndsAt,
              trialDaysLeft: daysLeft
            }
          : null,
        usage: {
          members: org._count.members,
          quizzes: org._count.quizzes,
          classes: org._count.classes,
          redeemCodes: redeemFeaturesAvailable ? org._count.redeemCodes : 0,
          codeRedemptions: redeemFeaturesAvailable ? org._count.redeemCodeUsages : 0
        },
        adminEmails,
        redeemCodes: redeemFeaturesAvailable ? org.redeemCodes.map((item: RedeemCode) => this.toRedeemCodeResponse(item)) : []
      };
    });
  }

  async getClientDetails(input: { actorEmail: string; organizationId: string }) {
    this.assertSuperAdmin(input.actorEmail);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: {
        subscription: true
      }
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const [members, recentAudit] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: {
          organizationId: input.organizationId
        },
        include: {
          role: {
            select: {
              key: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              lastLoginAt: true,
              createdAt: true
            }
          }
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.auditLog.findMany({
        where: {
          organizationId: input.organizationId
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 40
      })
    ]);

    let redeemCodes: RedeemCode[] = [];
    let redeemUsages: Array<any> = [];
    try {
      [redeemCodes, redeemUsages] = await Promise.all([
        this.prisma.redeemCode.findMany({
          where: {
            OR: [{ organizationId: input.organizationId }, { organizationId: null }]
          },
          orderBy: [{ organizationId: 'desc' }, { createdAt: 'desc' }],
          take: 50
        }),
        this.prisma.redeemCodeUsage.findMany({
          where: {
            organizationId: input.organizationId
          },
          include: {
            redeemCode: {
              select: {
                code: true,
                type: true,
                percentOff: true,
                freePeriodDays: true
              }
            },
            appliedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            usedAt: 'desc'
          },
          take: 30
        })
      ]);
    } catch (error) {
      if (!this.isRedeemTableUnavailableError(error)) {
        throw error;
      }
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        status: organization.status,
        createdAt: organization.createdAt,
        subscription: organization.subscription
          ? {
              planCode: organization.subscription.planCode,
              billingStatus: organization.subscription.billingStatus,
              trialStartedAt: organization.subscription.trialStartedAt,
              trialEndsAt: organization.subscription.trialEndsAt
            }
          : null
      },
      members: members.map((member) => ({
        id: member.id,
        status: member.status,
        joinedAt: member.createdAt,
        role: member.role,
        user: member.user
      })),
      redeemCodes: redeemCodes.map((item) => this.toRedeemCodeResponse(item)),
      redeemUsages: redeemUsages.map((item) => ({
        id: item.id,
        usedAt: item.usedAt,
        redeemCode: item.redeemCode,
        discountPercentApplied: item.discountPercentApplied,
        freePeriodDaysApplied: item.freePeriodDaysApplied,
        actor: item.appliedBy
          ? {
              id: item.appliedBy.id,
              email: item.appliedBy.email,
              name:
                [item.appliedBy.firstName, item.appliedBy.lastName].filter(Boolean).join(' ').trim() || null
            }
          : null,
        metadata: item.metadata
      })),
      recentAudit: recentAudit.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        actor: item.actor
          ? {
              id: item.actor.id,
              email: item.actor.email,
              name: [item.actor.firstName, item.actor.lastName].filter(Boolean).join(' ').trim() || null
            }
          : null,
        payload: item.payload
      }))
    };
  }

  async setClientFreeAccess(input: {
    actorEmail: string;
    actorUserId: string;
    organizationId: string;
    enabled: boolean;
  }) {
    this.assertSuperAdmin(input.actorEmail);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: {
        subscription: true,
        settings: true
      }
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const settings = this.readSettings(organization.settings?.settings);
    const nextSettings: Record<string, unknown> = {
      ...settings,
      superAdminFreeAccess: input.enabled,
      superAdminFreeAccessAt: new Date().toISOString(),
      superAdminFreeAccessBy: input.actorEmail
    };

    const billingStatus = input.enabled
      ? 'ACTIVE'
      : this.resolveNonFreeBillingStatus(organization.subscription?.trialEndsAt ?? null);

    await this.prisma.$transaction(async (tx) => {
      if (!organization.subscription) {
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planCode: this.defaultPlanForType(organization.type),
            billingStatus,
            trialStartedAt: new Date(),
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      } else {
        await tx.subscription.update({
          where: { organizationId: organization.id },
          data: { billingStatus }
        });
      }

      await tx.organizationSetting.upsert({
        where: { organizationId: organization.id },
        update: { settings: nextSettings as Prisma.InputJsonValue },
        create: {
          organizationId: organization.id,
          settings: nextSettings as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId,
          action: input.enabled ? 'SUPERADMIN_FREE_ACCESS_ENABLED' : 'SUPERADMIN_FREE_ACCESS_DISABLED',
          resourceType: 'ORGANIZATION',
          resourceId: organization.id,
          payload: {
            actorEmail: input.actorEmail,
            billingStatus
          }
        }
      });
    });

    return {
      organizationId: organization.id,
      freeAccessEnabled: input.enabled,
      billingStatus
    };
  }

  async extendClientTrial(input: {
    actorEmail: string;
    actorUserId: string;
    organizationId: string;
    days: number;
  }) {
    this.assertSuperAdmin(input.actorEmail);
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: { subscription: true }
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const nowMs = Date.now();
    const previousTrialEnd = organization.subscription?.trialEndsAt?.getTime() ?? null;
    const baseMs = previousTrialEnd && previousTrialEnd > nowMs ? previousTrialEnd : nowMs;
    const nextTrialEndsAt = new Date(baseMs + input.days * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      if (!organization.subscription) {
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planCode: this.defaultPlanForType(organization.type),
            billingStatus: 'TRIALING',
            trialStartedAt: new Date(),
            trialEndsAt: nextTrialEndsAt
          }
        });
      } else {
        const nextStatus =
          organization.subscription.billingStatus === 'ACTIVE' ? 'ACTIVE' : 'TRIALING';
        await tx.subscription.update({
          where: { organizationId: organization.id },
          data: {
            trialEndsAt: nextTrialEndsAt,
            billingStatus: nextStatus
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId,
          action: 'SUPERADMIN_TRIAL_EXTENDED',
          resourceType: 'SUBSCRIPTION',
          resourceId: organization.subscription?.id ?? organization.id,
          payload: {
            actorEmail: input.actorEmail,
            days: input.days,
            previousTrialEndsAt: organization.subscription?.trialEndsAt ?? null,
            nextTrialEndsAt
          }
        }
      });
    });

    return {
      organizationId: organization.id,
      daysExtended: input.days,
      trialEndsAt: nextTrialEndsAt
    };
  }

  async grantClientFreePeriod(input: {
    actorEmail: string;
    actorUserId: string;
    organizationId: string;
    days: number;
  }) {
    this.assertSuperAdmin(input.actorEmail);

    const result = await this.extendClientTrial(input);

    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'SUPERADMIN_FREE_PERIOD_GRANTED',
        resourceType: 'SUBSCRIPTION',
        resourceId: input.organizationId,
        payload: {
          actorEmail: input.actorEmail,
          days: input.days,
          trialEndsAt: result.trialEndsAt
        }
      }
    });

    return {
      ...result,
      freePeriodDaysGranted: input.days
    };
  }

  async listRedeemCodes(input: { actorEmail: string; organizationId: string | null }) {
    this.assertSuperAdmin(input.actorEmail);

    const codes = await this.prisma.redeemCode.findMany({
      where: {
        organizationId: input.organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return codes.map((item) => this.toRedeemCodeResponse(item));
  }

  async createRedeemCode(input: {
    actorEmail: string;
    actorUserId: string;
    organizationId: string | null;
    code?: string;
    type: 'PERCENT' | 'FREE_PERIOD';
    percentOff?: number;
    freePeriodDays?: number;
    maxRedemptions?: number;
    maxPerClient?: number;
    validFrom?: string;
    validUntil?: string;
    newSignupsOnly?: boolean;
  }) {
    this.assertSuperAdmin(input.actorEmail);

    if (input.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true }
      });
      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    const normalizedType = input.type?.trim().toUpperCase();
    if (normalizedType !== 'PERCENT' && normalizedType !== 'FREE_PERIOD') {
      throw new BadRequestException('Invalid redeem code type');
    }

    const normalizedCode = input.code?.trim().toUpperCase() || `QZ-${randomBytes(4).toString('hex').toUpperCase()}`;
    if (!/^[A-Z0-9_-]{4,40}$/.test(normalizedCode)) {
      throw new BadRequestException('Code format must be 4-40 chars (A-Z, 0-9, _, -)');
    }

    let percentOff: number | null = null;
    let freePeriodDays: number | null = null;
    if (normalizedType === 'PERCENT') {
      percentOff = Number(input.percentOff ?? 0);
      if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
        throw new BadRequestException('percentOff must be between 1 and 100');
      }
    } else {
      freePeriodDays = Number(input.freePeriodDays ?? 0);
      if (!Number.isFinite(freePeriodDays) || freePeriodDays < 1 || freePeriodDays > 3650) {
        throw new BadRequestException('freePeriodDays must be between 1 and 3650');
      }
    }

    const validFrom = input.validFrom ? new Date(input.validFrom) : null;
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    if (validFrom && Number.isNaN(validFrom.getTime())) {
      throw new BadRequestException('validFrom is invalid');
    }
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new BadRequestException('validUntil is invalid');
    }
    if (validFrom && validUntil && validFrom.getTime() >= validUntil.getTime()) {
      throw new BadRequestException('validUntil must be after validFrom');
    }

    const existing = await this.prisma.redeemCode.findUnique({
      where: { code: normalizedCode }
    });
    if (existing) {
      throw new BadRequestException('Redeem code already exists');
    }

    const created = await this.prisma.redeemCode.create({
      data: {
        organizationId: input.organizationId,
        code: normalizedCode,
        type: normalizedType,
        percentOff,
        freePeriodDays,
        maxRedemptions: input.maxRedemptions ?? null,
        maxPerClient: input.maxPerClient ?? 1,
        validFrom,
        validUntil,
        active: true,
        newSignupsOnly: input.newSignupsOnly ?? true,
        createdByUserId: input.actorUserId,
        createdByEmail: input.actorEmail
      }
    });

    if (input.organizationId) {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'SUPERADMIN_REDEEM_CODE_CREATED',
          resourceType: 'REDEEM_CODE',
          resourceId: created.id,
          payload: {
            code: created.code,
            type: created.type,
            maxRedemptions: created.maxRedemptions,
            maxPerClient: created.maxPerClient
          }
        }
      });
    }

    return this.toRedeemCodeResponse(created);
  }

  async disableRedeemCode(input: { actorEmail: string; organizationId: string | null; code: string }) {
    this.assertSuperAdmin(input.actorEmail);

    const normalizedCode = input.code.trim().toUpperCase();
    const redeemCode = await this.prisma.redeemCode.findFirst({
      where: {
        code: normalizedCode,
        organizationId: input.organizationId
      }
    });
    if (!redeemCode) {
      throw new NotFoundException('Redeem code not found');
    }

    await this.prisma.redeemCode.update({
      where: { id: redeemCode.id },
      data: { active: false }
    });

    return {
      code: redeemCode.code,
      active: false
    };
  }

  private toRedeemCodeResponse(item: RedeemCode) {
    return {
      id: item.id,
      organizationId: item.organizationId,
      code: item.code,
      type: item.type,
      percentOff: item.percentOff,
      freePeriodDays: item.freePeriodDays,
      maxRedemptions: item.maxRedemptions,
      maxPerClient: item.maxPerClient,
      redemptionCount: item.redemptionCount,
      validFrom: item.validFrom,
      validUntil: item.validUntil,
      active: item.active,
      newSignupsOnly: item.newSignupsOnly,
      createdByEmail: item.createdByEmail,
      createdAt: item.createdAt
    };
  }

  private assertSuperAdmin(email: string): void {
    const normalized = email.trim().toLowerCase();
    if (normalized !== SUPERADMIN_EMAIL) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private readSettings(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  private resolveNonFreeBillingStatus(trialEndsAt: Date | null): string {
    if (trialEndsAt && trialEndsAt.getTime() > Date.now()) {
      return 'TRIALING';
    }
    return 'TRIAL_EXPIRED';
  }

  private defaultPlanForType(type: OrganizationType): string {
    return type === 'PUBLISHER' || type === 'MEDIA_BRAND' ? 'PUBLISHER_GROWTH' : 'SCHOOL_GROWTH';
  }

  private isRedeemTableUnavailableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      message.includes('redeemcode') ||
      message.includes('redeemcodeusage') ||
      message.includes('p2021') ||
      message.includes('does not exist')
    );
  }
}
