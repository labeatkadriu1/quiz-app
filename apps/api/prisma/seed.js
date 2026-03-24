/* eslint-disable no-console */
require('dotenv').config();
const { PrismaClient, OrganizationType, MemberStatus, ClassMemberType, QuizStatus, AssignmentScopeType, QuestionType } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensureRole(organizationId, key, name) {
  const existing = await prisma.role.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key
      }
    }
  });
  if (existing) return existing;
  return prisma.role.create({
    data: { organizationId, key, name }
  });
}

async function main() {
  const adminEmail = 'seed-admin@quizos.local';
  const teacherEmail = 'seed-teacher@quizos.local';
  const studentEmail = 'seed-student@quizos.local';
  const passHash = await bcrypt.hash('SeedPass123!', 10);

  const [adminUser, teacherUser, studentUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { email: adminEmail, passwordHash: passHash, firstName: 'Seed', lastName: 'Admin' }
    }),
    prisma.user.upsert({
      where: { email: teacherEmail },
      update: {},
      create: { email: teacherEmail, passwordHash: passHash, firstName: 'Seed', lastName: 'Teacher' }
    }),
    prisma.user.upsert({
      where: { email: studentEmail },
      update: {},
      create: { email: studentEmail, passwordHash: passHash, firstName: 'Seed', lastName: 'Student' }
    })
  ]);

  const organization = await prisma.organization.create({
    data: {
      name: `Seed School ${new Date().toISOString().slice(0, 10)}`,
      type: OrganizationType.SCHOOL,
      settings: {
        create: {
          settings: {
            leaderboardEnabled: true,
            auditLogging: true
          }
        }
      },
      subscription: {
        create: {
          planCode: 'SCHOOL_GROWTH',
          billingStatus: 'ACTIVE'
        }
      }
    }
  });

  const adminRole = await ensureRole(organization.id, 'ORGANIZATION_ADMIN', 'Organization Admin');
  const teacherRole = await ensureRole(organization.id, 'TEACHER', 'Teacher');
  const studentRole = await ensureRole(organization.id, 'STUDENT', 'Student');

  await prisma.organizationMember.createMany({
    data: [
      { organizationId: organization.id, userId: adminUser.id, roleId: adminRole.id, status: MemberStatus.ACTIVE },
      { organizationId: organization.id, userId: teacherUser.id, roleId: teacherRole.id, status: MemberStatus.ACTIVE },
      { organizationId: organization.id, userId: studentUser.id, roleId: studentRole.id, status: MemberStatus.ACTIVE }
    ],
    skipDuplicates: true
  });

  const school = await prisma.school.create({
    data: {
      organizationId: organization.id,
      name: 'Seed School',
      timezone: 'Europe/Belgrade'
    }
  });

  const classItem = await prisma.class.create({
    data: {
      organizationId: organization.id,
      schoolId: school.id,
      name: 'Class A',
      code: 'A1'
    }
  });

  await prisma.classMembership.createMany({
    data: [
      {
        organizationId: organization.id,
        classId: classItem.id,
        userId: teacherUser.id,
        memberType: ClassMemberType.TEACHER
      },
      {
        organizationId: organization.id,
        classId: classItem.id,
        userId: studentUser.id,
        memberType: ClassMemberType.STUDENT
      }
    ],
    skipDuplicates: true
  });

  const quiz = await prisma.quiz.create({
    data: {
      organizationId: organization.id,
      ownerUserId: teacherUser.id,
      title: 'Seed Quiz',
      description: 'Seed quiz for QA flow',
      status: QuizStatus.PUBLISHED,
      contentType: 'QUIZ',
      visibility: 'PRIVATE',
      publishedAt: new Date(),
      questions: {
        create: [
          {
            type: QuestionType.SINGLE_CHOICE,
            prompt: '2 + 2 = ?',
            points: 1,
            position: 1,
            answerOptions: {
              create: [
                { label: '3', value: '3', position: 1, isCorrect: false },
                { label: '4', value: '4', position: 2, isCorrect: true }
              ]
            }
          }
        ]
      }
    }
  });

  const assignment = await prisma.quizAssignment.create({
    data: {
      organizationId: organization.id,
      quizId: quiz.id,
      assignedById: teacherUser.id,
      scopeType: AssignmentScopeType.REQUEST_LINK,
      requestAccessToken: 'seed-request-token',
      targets: {
        create: [{ targetType: AssignmentScopeType.REQUEST_LINK }]
      }
    }
  });

  await prisma.assignmentAccessRequest.create({
    data: {
      organizationId: organization.id,
      quizId: quiz.id,
      assignmentId: assignment.id,
      name: 'Seed Pending',
      email: 'seed-pending@quizos.local',
      status: 'PENDING'
    }
  });

  console.log('Seed complete');
  console.log({
    organizationId: organization.id,
    quizId: quiz.id,
    classId: classItem.id,
    requestLink: `${process.env.WEB_URL || 'http://localhost:3001'}/request-assignment/seed-request-token`
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
