import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanLimits {
  memberLimit: number;
  quizLimit: number;
  monthlyAttemptLimit: number;
}

export interface BillingGuardState {
  planCode: string;
  billingStatus: string;
  trialEndsAt: Date | null;
  paymentRequired: boolean;
  limits: PlanLimits;
}

export function limitsForPlan(planCode: string | null | undefined): PlanLimits {
  switch ((planCode ?? '').toUpperCase()) {
    case 'SCHOOL_STARTER':
      return { memberLimit: 50, quizLimit: 50, monthlyAttemptLimit: 5000 };
    case 'SCHOOL_GROWTH':
      return { memberLimit: 250, quizLimit: 500, monthlyAttemptLimit: 50000 };
    case 'SCHOOL_PRO':
      return { memberLimit: 2000, quizLimit: 5000, monthlyAttemptLimit: 500000 };
    case 'PUBLISHER_STARTER':
      return { memberLimit: 25, quizLimit: 100, monthlyAttemptLimit: 20000 };
    case 'PUBLISHER_GROWTH':
      return { memberLimit: 100, quizLimit: 1000, monthlyAttemptLimit: 120000 };
    case 'PUBLISHER_PRO':
      return { memberLimit: 500, quizLimit: 5000, monthlyAttemptLimit: 1000000 };
    default:
      return { memberLimit: 250, quizLimit: 500, monthlyAttemptLimit: 50000 };
  }
}

export async function getBillingGuardState(prisma: PrismaService, organizationId: string): Promise<BillingGuardState> {
  if (!organizationId) {
    throw new BadRequestException('x-organization-id header is required');
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId }
  });
  if (!subscription) {
    return {
      planCode: 'UNCONFIGURED',
      billingStatus: 'UNCONFIGURED',
      trialEndsAt: null,
      paymentRequired: true,
      limits: limitsForPlan(null)
    };
  }

  const nowMs = Date.now();
  const trialExpired =
    subscription.billingStatus === 'TRIALING' &&
    subscription.trialEndsAt instanceof Date &&
    subscription.trialEndsAt.getTime() < nowMs;

  const billingStatus = trialExpired ? 'TRIAL_EXPIRED' : subscription.billingStatus;
  const paymentRequired =
    subscription.billingStatus !== 'ACTIVE' &&
    (subscription.billingStatus !== 'TRIALING' || trialExpired);

  return {
    planCode: subscription.planCode,
    billingStatus,
    trialEndsAt: subscription.trialEndsAt,
    paymentRequired,
    limits: limitsForPlan(subscription.planCode)
  };
}

export async function assertBillingAccess(prisma: PrismaService, organizationId: string): Promise<BillingGuardState> {
  const state = await getBillingGuardState(prisma, organizationId);
  if (state.paymentRequired) {
    throw new ForbiddenException('Trial has expired. Activate billing to continue.');
  }
  return state;
}
