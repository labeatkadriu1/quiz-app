import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getBillingGuardState } from '../organizations/plan-limits';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const method = (request.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const path = request.originalUrl ?? '';
    if (path.includes('/organizations/current/billing/activate')) {
      return true;
    }

    const rawOrgId = request.headers?.['x-organization-id'];
    const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
    if (!organizationId) {
      return true;
    }

    const billing = await getBillingGuardState(this.prisma, organizationId);
    if (billing.paymentRequired) {
      throw new ForbiddenException('Feature locked: trial expired. Activate billing to continue.');
    }
    return true;
  }
}
