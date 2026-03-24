import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassMemberType, JoinRequestStatus, MemberStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { assertBillingAccess } from '../organizations/plan-limits';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async createSchool(input: {
    organizationId: string;
    name: string;
    timezone?: string;
    actorUserId: string;
  }) {
    await assertBillingAccess(this.prisma, input.organizationId);
    await this.assertTeacherOrAdmin(input.organizationId, input.actorUserId);

    return this.prisma.school.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        timezone: input.timezone
      }
    });
  }

  async listSchools(input: { organizationId: string; actorUserId: string }) {
    await this.assertActiveMembership(input.organizationId, input.actorUserId);

    return this.prisma.school.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createClass(input: {
    organizationId: string;
    schoolId: string;
    name: string;
    code?: string;
    gradeLevel?: string;
    actorUserId: string;
  }) {
    await assertBillingAccess(this.prisma, input.organizationId);
    await this.assertTeacherOrAdmin(input.organizationId, input.actorUserId);

    const school = await this.prisma.school.findFirst({
      where: {
        id: input.schoolId,
        organizationId: input.organizationId
      }
    });
    if (!school) {
      throw new NotFoundException('School not found in this organization');
    }

    const created = await this.prisma.class.create({
      data: {
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        name: input.name,
        code: input.code,
        gradeLevel: input.gradeLevel
      }
    });

    const actorMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.actorUserId
        }
      },
      include: { role: true }
    });

    if (actorMembership?.role?.key?.includes('TEACHER') && !actorMembership.role.key.includes('ADMIN')) {
      await this.prisma.classMembership.upsert({
        where: {
          classId_userId_memberType: {
            classId: created.id,
            userId: input.actorUserId,
            memberType: ClassMemberType.TEACHER
          }
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          classId: created.id,
          userId: input.actorUserId,
          memberType: ClassMemberType.TEACHER
        }
      });
    }

    return created;
  }

  async addMember(input: {
    organizationId: string;
    classId: string;
    userId: string;
    memberType: ClassMemberType;
    actorUserId: string;
  }) {
    await this.assertClassManager(input.organizationId, input.classId, input.actorUserId);
    const billing = await assertBillingAccess(this.prisma, input.organizationId);

    if (input.memberType === ClassMemberType.TEACHER) {
      await this.assertAdmin(input.organizationId, input.actorUserId);
    }

    const activeMemberCount = await this.prisma.organizationMember.count({
      where: {
        organizationId: input.organizationId,
        status: MemberStatus.ACTIVE
      }
    });
    if (activeMemberCount >= billing.limits.memberLimit) {
      throw new BadRequestException(
        `Member limit reached (${billing.limits.memberLimit}) for current plan.`
      );
    }

    return this.prisma.classMembership.upsert({
      where: {
        classId_userId_memberType: {
          classId: input.classId,
          userId: input.userId,
          memberType: input.memberType
        }
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        classId: input.classId,
        userId: input.userId,
        memberType: input.memberType
      }
    });
  }

  async createJoinLink(input: { organizationId: string; classId: string; actorUserId: string; expiresAt?: Date }) {
    await assertBillingAccess(this.prisma, input.organizationId);
    await this.assertClassManager(input.organizationId, input.classId, input.actorUserId);

    const classItem = await this.prisma.class.findFirst({
      where: {
        id: input.classId,
        organizationId: input.organizationId
      }
    });
    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const link = await this.prisma.classJoinLink.create({
      data: {
        organizationId: input.organizationId,
        classId: input.classId,
        tokenHash,
        expiresAt: input.expiresAt,
        createdByUserId: input.actorUserId,
        active: true
      }
    });

    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    return {
      id: link.id,
      classId: link.classId,
      joinUrl: `${webUrl}/join-class/${rawToken}`,
      expiresAt: link.expiresAt,
      active: link.active
    };
  }

  async getJoinLinkPublic(input: { token: string }) {
    const tokenHash = createHash('sha256').update(input.token.trim()).digest('hex');
    const link = await this.prisma.classJoinLink.findUnique({
      where: { tokenHash },
      include: {
        class: {
          include: {
            school: true
          }
        }
      }
    });

    if (!link || !link.active) {
      throw new NotFoundException('Join link not found or inactive');
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Join link has expired');
    }

    return {
      classId: link.class.id,
      className: link.class.name,
      schoolName: link.class.school.name,
      organizationId: link.organizationId,
      expiresAt: link.expiresAt
    };
  }

  async requestJoinByLink(input: { token: string; email: string; note?: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const tokenHash = createHash('sha256').update(input.token.trim()).digest('hex');
    const link = await this.prisma.classJoinLink.findUnique({
      where: { tokenHash }
    });
    if (!link || !link.active) {
      throw new NotFoundException('Join link not found or inactive');
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Join link has expired');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    const existingRequest = await this.prisma.classJoinRequest.findFirst({
      where: {
        classId: link.classId,
        email: normalizedEmail,
        status: JoinRequestStatus.PENDING
      }
    });
    if (existingRequest) {
      return {
        requestId: existingRequest.id,
        status: existingRequest.status,
        message: 'Join request already pending approval'
      };
    }

    const request = await this.prisma.classJoinRequest.create({
      data: {
        organizationId: link.organizationId,
        classId: link.classId,
        joinLinkId: link.id,
        email: normalizedEmail,
        studentUserId: existingUser?.id,
        note: input.note
      }
    });

    return {
      requestId: request.id,
      status: request.status,
      message: 'Join request submitted. Teacher/Admin approval required.'
    };
  }

  async listJoinRequests(input: {
    organizationId: string;
    classId: string;
    actorUserId: string;
    status?: JoinRequestStatus;
  }) {
    await this.assertClassManager(input.organizationId, input.classId, input.actorUserId);

    return this.prisma.classJoinRequest.findMany({
      where: {
        organizationId: input.organizationId,
        classId: input.classId,
        ...(input.status ? { status: input.status } : {})
      },
      include: {
        class: {
          include: {
            school: true
          }
        },
        studentUser: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });
  }

  async reviewJoinRequest(input: {
    organizationId: string;
    requestId: string;
    actorUserId: string;
    approve: boolean;
  }) {
    const billing = await assertBillingAccess(this.prisma, input.organizationId);
    const request = await this.prisma.classJoinRequest.findFirst({
      where: {
        id: input.requestId,
        organizationId: input.organizationId
      },
      include: {
        class: {
          include: {
            school: true
          }
        }
      }
    });
    if (!request) {
      throw new NotFoundException('Join request not found');
    }

    await this.assertClassManager(input.organizationId, request.classId, input.actorUserId);

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('Join request is not pending');
    }

    if (!input.approve) {
      const rejected = await this.prisma.classJoinRequest.update({
        where: { id: request.id },
        data: {
          status: JoinRequestStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedByUserId: input.actorUserId
        }
      });
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CLASS_JOIN_REQUEST_REJECTED',
          resourceType: 'CLASS_JOIN_REQUEST',
          resourceId: request.id,
          payload: {
            classId: request.classId,
            email: request.email
          }
        }
      });
      await this.emailService.sendClassJoinReviewedEmail({
        toEmail: request.email,
        className: request.class.name,
        schoolName: request.class.school.name,
        approved: false,
        loginUrl: `${process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'}/login`
      });
      return rejected;
    }

    const activeMemberCount = await this.prisma.organizationMember.count({
      where: {
        organizationId: input.organizationId,
        status: MemberStatus.ACTIVE
      }
    });
    if (activeMemberCount >= billing.limits.memberLimit) {
      throw new BadRequestException(
        `Member limit reached (${billing.limits.memberLimit}) for current plan.`
      );
    }

    const user = request.studentUserId
      ? await this.prisma.user.findUnique({ where: { id: request.studentUserId } })
      : await this.prisma.user.findUnique({ where: { email: request.email } });

    const [firstName, ...rest] = request.email.split('@')[0].split(/[._-]/g).filter(Boolean);
    const defaultLastName = rest.join(' ').trim();

    const approved = await this.prisma.$transaction(async (tx) => {
      const studentRole = await this.ensureOrganizationRole(tx, input.organizationId, 'STUDENT', 'Student');
      const ensuredUser =
        user ??
        (await tx.user.create({
          data: {
            email: request.email,
            firstName: firstName || 'Student',
            lastName: defaultLastName || null,
            passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
            status: 'ACTIVE'
          }
        }));

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ensuredUser.id
          }
        },
        update: {
          status: MemberStatus.ACTIVE,
          roleId: studentRole.id
        },
        create: {
          organizationId: input.organizationId,
          userId: ensuredUser.id,
          roleId: studentRole.id,
          status: MemberStatus.ACTIVE
        }
      });

      await tx.classMembership.upsert({
        where: {
          classId_userId_memberType: {
            classId: request.classId,
            userId: ensuredUser.id,
            memberType: ClassMemberType.STUDENT
          }
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          classId: request.classId,
          userId: ensuredUser.id,
          memberType: ClassMemberType.STUDENT
        }
      });

      const reviewed = await tx.classJoinRequest.update({
        where: { id: request.id },
        data: {
          status: JoinRequestStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedByUserId: input.actorUserId,
          studentUserId: ensuredUser.id
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CLASS_JOIN_REQUEST_APPROVED',
          resourceType: 'CLASS_JOIN_REQUEST',
          resourceId: request.id,
          payload: {
            classId: request.classId,
            email: request.email,
            studentUserId: ensuredUser.id
          }
        }
      });

      return {
        reviewed,
        userId: ensuredUser.id
      };
    });

    await this.emailService.sendClassJoinReviewedEmail({
      toEmail: request.email,
      className: request.class.name,
      schoolName: request.class.school.name,
      approved: true,
      loginUrl: `${process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001'}/login`
    });

    return {
      approved: true,
      requestId: request.id,
      classId: request.classId,
      studentUserId: approved.userId
    };
  }

  async listForOrganization(input: { organizationId: string; actorUserId: string }) {
    await this.assertActiveMembership(input.organizationId, input.actorUserId);

    return this.prisma.class.findMany({
      where: { organizationId: input.organizationId },
      include: {
        school: true,
        memberships: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        },
        joinLinks: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            active: true,
            createdAt: true
          }
        },
        joinRequests: {
          where: { status: JoinRequestStatus.PENDING },
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async assertAdmin(organizationId: string, userId: string): Promise<void> {
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
      throw new ForbiddenException('Admin role required');
    }
  }

  private async assertTeacherOrAdmin(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      include: { role: true }
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }

    const roleKey = membership.role?.key ?? '';
    if (!roleKey.includes('ADMIN') && !roleKey.includes('TEACHER')) {
      throw new ForbiddenException('Teacher or admin role required');
    }
  }

  private async assertClassManager(organizationId: string, classId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      include: { role: true }
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }

    if (membership.role?.key?.includes('ADMIN')) {
      return;
    }

    const teacherInClass = await this.prisma.classMembership.findFirst({
      where: {
        organizationId,
        classId,
        userId,
        memberType: ClassMemberType.TEACHER
      }
    });

    if (!teacherInClass) {
      throw new ForbiddenException('Only class teacher or organization admin can perform this action');
    }
  }

  private async assertActiveMembership(organizationId: string, userId: string): Promise<void> {
    if (!organizationId) {
      throw new BadRequestException('x-organization-id header is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      }
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }
  }

  private async ensureOrganizationRole(
    tx: Prisma.TransactionClient,
    organizationId: string,
    key: string,
    name: string
  ) {
    const role = await tx.role.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key
        }
      }
    });
    if (role) {
      return role;
    }
    return tx.role.create({
      data: {
        organizationId,
        key,
        name
      }
    });
  }
}
