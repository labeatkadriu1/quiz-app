import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus, MemberStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

export type InviteScope = 'ACTIVE_ORG' | 'SPECIFIC_ORG' | 'ALL_ADMIN_ORGS' | 'ALL_SCHOOL_ORGS';

const ROLE_NAME_MAP: Record<string, string> = {
  ORGANIZATION_ADMIN: 'Organization Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PUBLISHER_ADMIN: 'Publisher Admin',
  PUBLISHER_EDITOR: 'Publisher Editor',
  VIEWER_ANALYST: 'Viewer / Analyst'
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService
  ) {}

  async createInvitations(input: {
    inviterUserId: string;
    email: string;
    roleKey: string;
    scope: InviteScope;
    activeOrganizationId?: string;
    specificOrganizationId?: string;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const targetOrganizations = await this.resolveTargetOrganizations({
      inviterUserId: input.inviterUserId,
      scope: input.scope,
      activeOrganizationId: input.activeOrganizationId,
      specificOrganizationId: input.specificOrganizationId
    });
    if (targetOrganizations.length === 0) {
      throw new ForbiddenException('No organizations available for this invite scope');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: Array<{
        organizationId: string;
        organizationName: string;
        roleName: string;
        invitationId: string;
        inviteToken: string;
        expiresAt: Date;
      }> = [];

      for (const org of targetOrganizations) {
        const role = await this.ensureRole(tx, org.id, input.roleKey);
        const inviteToken = randomBytes(24).toString('hex');
        const tokenHash = createHash('sha256').update(inviteToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const invitation = await tx.invitation.create({
          data: {
            organizationId: org.id,
            email: normalizedEmail,
            roleId: role.id,
            tokenHash,
            expiresAt,
            invitedByUserId: input.inviterUserId
          }
        });

        rows.push({
          organizationId: org.id,
          organizationName: org.name,
          roleName: role.name,
          invitationId: invitation.id,
          inviteToken,
          expiresAt
        });
      }

      return rows;
    });

    const emailResults = await Promise.all(
      created.map((item) =>
        this.emailService.sendInvitationEmail({
          toEmail: normalizedEmail,
          organizationName: item.organizationName,
          roleName: item.roleName,
          acceptUrl: `${webUrl}/invite/${item.inviteToken}`,
          expiresAt: item.expiresAt
        })
      )
    );
    const deliveredCount = emailResults.filter((result) => result.delivered).length;

    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    return {
      scope: input.scope,
      email: normalizedEmail,
      createdCount: created.length,
      deliveredCount,
      invitations: created.map((item, index) => ({
        organizationId: item.organizationId,
        invitationId: item.invitationId,
        acceptUrl: emailResults[index]?.delivered ? undefined : `${webUrl}/invite/${item.inviteToken}`
      }))
    };
  }

  async acceptInvitation(input: {
    token: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }) {
    const token = input.token.trim();
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        role: true
      }
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() }
    });

    let user = existingUser;
    if (!user) {
      const rawPassword = input.password ?? '';
      if (rawPassword.length < 8) {
        throw new BadRequestException('Password is required for new account (min 8 chars)');
      }
      const passwordHash = await bcrypt.hash(rawPassword, 12);
      user = await this.prisma.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          status: 'ACTIVE'
        }
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user!.id
          }
        },
        update: {
          roleId: invitation.roleId ?? undefined,
          status: MemberStatus.ACTIVE
        },
        create: {
          organizationId: invitation.organizationId,
          userId: user!.id,
          roleId: invitation.roleId ?? undefined,
          status: MemberStatus.ACTIVE
        }
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED }
      });
    });

    const tokens = await this.authService.issueTokensForUser({
      id: user.id,
      email: user.email
    });

    return {
      message: 'Invitation accepted',
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        type: invitation.organization.type
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      tokens
    };
  }

  async listForOrganization(input: { organizationId: string; actorUserId: string }) {
    await this.assertAdminMembership(input.organizationId, input.actorUserId);

    return this.prisma.invitation.findMany({
      where: { organizationId: input.organizationId },
      include: {
        role: { select: { key: true, name: true } },
        invitedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async resendInvitation(input: { organizationId: string; invitationId: string; actorUserId: string }) {
    await this.assertAdminMembership(input.organizationId, input.actorUserId);

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: input.invitationId,
        organizationId: input.organizationId
      },
      include: {
        organization: true,
        role: true
      }
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be resent');
    }

    const inviteToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        expiresAt
      }
    });

    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    const delivered = await this.emailService.sendInvitationEmail({
      toEmail: invitation.email,
      organizationName: invitation.organization.name,
      roleName: invitation.role?.name ?? invitation.role?.key ?? 'Member',
      acceptUrl: `${webUrl}/invite/${inviteToken}`,
      expiresAt
    });

    return {
      invitationId: invitation.id,
      delivered: delivered.delivered,
      reason: delivered.reason,
      acceptUrl: delivered.delivered ? undefined : `${webUrl}/invite/${inviteToken}`
    };
  }

  async deleteInvitation(input: { organizationId: string; invitationId: string; actorUserId: string }) {
    await this.assertAdminMembership(input.organizationId, input.actorUserId);

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: input.invitationId,
        organizationId: input.organizationId
      },
      select: {
        id: true
      }
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.prisma.invitation.delete({
      where: { id: invitation.id }
    });

    return { deleted: true, invitationId: invitation.id };
  }

  private async resolveTargetOrganizations(input: {
    inviterUserId: string;
    scope: InviteScope;
    activeOrganizationId?: string;
    specificOrganizationId?: string;
  }) {
    const adminMemberships = await this.prisma.organizationMember.findMany({
      where: {
        userId: input.inviterUserId,
        status: MemberStatus.ACTIVE,
        role: { key: { contains: 'ADMIN' } }
      },
      include: {
        organization: true
      }
    });

    if (input.scope === 'ACTIVE_ORG') {
      if (!input.activeOrganizationId) {
        throw new BadRequestException('x-organization-id header is required for ACTIVE_ORG invites');
      }
      const found = adminMemberships.find((item) => item.organizationId === input.activeOrganizationId);
      if (!found) {
        throw new ForbiddenException('Admin access required for this organization');
      }
      return [found.organization];
    }

    if (input.scope === 'SPECIFIC_ORG') {
      if (!input.specificOrganizationId) {
        throw new BadRequestException('specificOrganizationId is required for SPECIFIC_ORG invites');
      }
      const found = adminMemberships.find((item) => item.organizationId === input.specificOrganizationId);
      if (!found) {
        throw new ForbiddenException('Admin access required for selected organization');
      }
      return [found.organization];
    }

    if (input.scope === 'ALL_SCHOOL_ORGS') {
      return adminMemberships
        .map((item) => item.organization)
        .filter((org) => org.type === 'SCHOOL');
    }

    return adminMemberships.map((item) => item.organization);
  }

  private async assertAdminMembership(organizationId: string, userId: string): Promise<void> {
    if (!organizationId) {
      throw new BadRequestException('x-organization-id header is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      include: { role: true }
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE || !membership.role?.key?.includes('ADMIN')) {
      throw new ForbiddenException('Admin membership required');
    }
  }

  private async ensureRole(tx: Prisma.TransactionClient, organizationId: string, roleKey: string) {
    const key = roleKey.trim().toUpperCase();
    if (!key) {
      throw new BadRequestException('roleKey is required');
    }

    const existing = await tx.role.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key
        }
      }
    });
    if (existing) {
      return existing;
    }

    return tx.role.create({
      data: {
        organizationId,
        key,
        name: ROLE_NAME_MAP[key] ?? key.replace(/_/g, ' ')
      }
    });
  }
}
