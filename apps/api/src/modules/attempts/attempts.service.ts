import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AssignmentScopeType,
  AttemptStatus,
  ClassMemberType,
  MemberStatus,
  Prisma,
  QuestionType,
  QuizStatus,
  QuizVisibility
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

interface AnswerInput {
  questionId: string;
  answerPayload: Record<string, unknown>;
}

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async startAttempt(input: { organizationId: string; quizId: string; userId: string }) {
    const membership = await this.assertMembership(input.organizationId, input.userId);
    if (!membership) {
      throw new ForbiddenException('Active organization membership required');
    }

    const quiz = await this.prisma.quiz.findFirst({
      where: { id: input.quizId, organizationId: input.organizationId },
      include: {
        assignments: {
          include: { targets: true }
        }
      }
    });
    if (!quiz || quiz.status !== QuizStatus.PUBLISHED) {
      throw new NotFoundException('Published quiz not found');
    }

    const assignment = await this.resolveAssignmentAccess({
      organizationId: input.organizationId,
      quizId: input.quizId,
      userId: input.userId
    });

    if (!assignment && quiz.visibility === QuizVisibility.PRIVATE) {
      throw new ForbiddenException('No access to this quiz');
    }

    const attemptsUsed = await this.prisma.quizAttempt.count({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId,
        userId: input.userId,
        status: AttemptStatus.SUBMITTED
      }
    });

    const limit = assignment?.attemptLimit ?? quiz.attemptLimitDefault;
    if (limit && attemptsUsed >= limit) {
      throw new ForbiddenException('Attempt limit reached');
    }

    return this.prisma.quizAttempt.create({
      data: {
        organizationId: input.organizationId,
        quizId: input.quizId,
        assignmentId: assignment?.id,
        userId: input.userId,
        status: AttemptStatus.IN_PROGRESS
      }
    });
  }

  async saveAnswer(input: {
    organizationId: string;
    attemptId: string;
    userId: string;
    answer: AnswerInput;
  }) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: input.attemptId,
        organizationId: input.organizationId,
        userId: input.userId
      }
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is not in progress');
    }

    return this.prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: input.attemptId,
          questionId: input.answer.questionId
        }
      },
      update: {
        answerPayload: input.answer.answerPayload as Prisma.InputJsonValue
      },
      create: {
        attemptId: input.attemptId,
        questionId: input.answer.questionId,
        answerPayload: input.answer.answerPayload as Prisma.InputJsonValue
      }
    });
  }

  async submitAttempt(input: { organizationId: string; attemptId: string; userId: string }) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: input.attemptId,
        organizationId: input.organizationId,
        userId: input.userId
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                answerOptions: true
              }
            }
          }
        },
        answers: true,
        assignment: true
      }
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const answersByQuestion = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer.answerPayload as Record<string, unknown>])
    );

    let totalPoints = 0;
    let earnedPoints = 0;

    const updates: Array<{ questionId: string; isCorrect: boolean | null; pointsAwarded: number }> = [];

    for (const question of attempt.quiz.questions) {
      totalPoints += question.points;
      const payload = answersByQuestion.get(question.id);
      const result = this.gradeQuestion(question.type, question.points, payload, question.answerOptions);
      if (result.pointsAwarded > 0) {
        earnedPoints += result.pointsAwarded;
      }
      updates.push({
        questionId: question.id,
        isCorrect: result.isCorrect,
        pointsAwarded: result.pointsAwarded
      });
    }

    const percentage = totalPoints > 0 ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;
    const passScore = attempt.assignment?.passScoreOverride ?? attempt.quiz.passScore;
    const passed = percentage >= passScore;

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.attemptAnswer.updateMany({
          where: {
            attemptId: attempt.id,
            questionId: update.questionId
          },
          data: {
            isCorrect: update.isCorrect ?? undefined,
            pointsAwarded: update.pointsAwarded
          }
        });
      }

      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          score: earnedPoints,
          percentage
        }
      });

      await tx.result.create({
        data: {
          organizationId: input.organizationId,
          attemptId: attempt.id,
          quizId: attempt.quizId,
          userId: input.userId,
          totalPoints,
          earnedPoints,
          percentage,
          passed
        }
      });
    });

    return this.getResult({
      organizationId: input.organizationId,
      attemptId: input.attemptId,
      userId: input.userId
    });
  }

  async getResult(input: { organizationId: string; attemptId: string; userId: string }) {
    const result = await this.prisma.result.findFirst({
      where: {
        organizationId: input.organizationId,
        attemptId: input.attemptId,
        userId: input.userId
      }
    });

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    return result;
  }

  async startPublicAttempt(input: { quizId: string; token: string; password?: string; email?: string }) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      include: {
        assignments: { include: { targets: true } }
      }
    });
    if (!quiz || quiz.status !== QuizStatus.PUBLISHED) {
      throw new NotFoundException('Published quiz not found');
    }
    if (!quiz.publicAccessEnabled || !quiz.publicAccessToken || quiz.publicAccessToken !== input.token) {
      throw new ForbiddenException('Public access is not enabled for this quiz');
    }

    const mode = (quiz.publicAccessMode ?? 'PUBLIC_LINK') as 'PUBLIC_LINK' | 'APPROVAL' | 'PASSWORD';
    if (mode === 'PASSWORD') {
      if (!input.password || !quiz.publicAccessPasswordHash) {
        throw new ForbiddenException('Password required');
      }
      const valid = await bcrypt.compare(input.password, quiz.publicAccessPasswordHash);
      if (!valid) {
        throw new ForbiddenException('Invalid password');
      }
    }

    if (mode === 'APPROVAL') {
      const email = input.email?.trim().toLowerCase();
      const approvedEmails = Array.isArray(quiz.publicAccessApprovedEmails)
        ? quiz.publicAccessApprovedEmails
        : [];
      if (!email || !approvedEmails.includes(email)) {
        throw new ForbiddenException('Email is not approved for this quiz');
      }
    }

    return this.prisma.quizAttempt.create({
      data: {
        organizationId: quiz.organizationId,
        quizId: quiz.id,
        status: AttemptStatus.IN_PROGRESS
      }
    });
  }

  async savePublicAnswer(input: { attemptId: string; answer: AnswerInput }) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: input.attemptId }
    });
    if (!attempt || attempt.userId) {
      throw new NotFoundException('Public attempt not found');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is not in progress');
    }

    return this.prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: input.attemptId,
          questionId: input.answer.questionId
        }
      },
      update: {
        answerPayload: input.answer.answerPayload as Prisma.InputJsonValue
      },
      create: {
        attemptId: input.attemptId,
        questionId: input.answer.questionId,
        answerPayload: input.answer.answerPayload as Prisma.InputJsonValue
      }
    });
  }

  async submitPublicAttempt(input: { attemptId: string }) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: input.attemptId },
      include: {
        quiz: {
          include: {
            questions: { include: { answerOptions: true } }
          }
        },
        answers: true,
        assignment: true
      }
    });
    if (!attempt || attempt.userId) {
      throw new NotFoundException('Public attempt not found');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const answersByQuestion = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer.answerPayload as Record<string, unknown>])
    );

    let totalPoints = 0;
    let earnedPoints = 0;
    const updates: Array<{ questionId: string; isCorrect: boolean | null; pointsAwarded: number }> = [];

    for (const question of attempt.quiz.questions) {
      totalPoints += question.points;
      const payload = answersByQuestion.get(question.id);
      const result = this.gradeQuestion(question.type, question.points, payload, question.answerOptions);
      if (result.pointsAwarded > 0) {
        earnedPoints += result.pointsAwarded;
      }
      updates.push({
        questionId: question.id,
        isCorrect: result.isCorrect,
        pointsAwarded: result.pointsAwarded
      });
    }

    const percentage = totalPoints > 0 ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;
    const passScore = attempt.assignment?.passScoreOverride ?? attempt.quiz.passScore;
    const passed = percentage >= passScore;

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.attemptAnswer.updateMany({
          where: {
            attemptId: attempt.id,
            questionId: update.questionId
          },
          data: {
            isCorrect: update.isCorrect ?? undefined,
            pointsAwarded: update.pointsAwarded
          }
        });
      }

      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.SUBMITTED,
          submittedAt: new Date(),
          score: earnedPoints,
          percentage
        }
      });

      await tx.result.create({
        data: {
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          quizId: attempt.quizId,
          totalPoints,
          earnedPoints,
          percentage,
          passed
        }
      });
    });

    return this.getPublicResult({ attemptId: attempt.id });
  }

  async getPublicResult(input: { attemptId: string }) {
    const result = await this.prisma.result.findFirst({
      where: {
        attemptId: input.attemptId,
        userId: null
      },
      include: {
        attempt: {
          include: {
            answers: true,
            quiz: {
              include: {
                questions: {
                  include: {
                    answerOptions: {
                      orderBy: { position: 'asc' }
                    }
                  },
                  orderBy: { position: 'asc' }
                }
              }
            }
          }
        }
      }
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }

    const answerMap = new Map(
      result.attempt.answers.map((answer) => [answer.questionId, answer])
    );

    const answerReview = result.attempt.quiz.questions.map((question) => {
      const answer = answerMap.get(question.id);
      const payload =
        answer && answer.answerPayload && typeof answer.answerPayload === 'object'
          ? (answer.answerPayload as Record<string, unknown>)
          : null;
      const selectedOptionIds = Array.isArray(payload?.selectedOptionIds)
        ? payload.selectedOptionIds.filter((value): value is string => typeof value === 'string')
        : [];
      const selectedOptionLabels = selectedOptionIds
        .map((id) => question.answerOptions.find((option) => option.id === id)?.label)
        .filter((label): label is string => Boolean(label));

      const correctOptions = question.answerOptions.filter((option) => option.isCorrect);
      return {
        questionId: question.id,
        position: question.position,
        prompt: question.prompt,
        type: question.type,
        selectedOptionIds,
        selectedOptionLabels,
        shortTextAnswer:
          typeof payload?.text === 'string'
            ? payload.text
            : typeof payload?.answerText === 'string'
              ? payload.answerText
              : null,
        correctOptionIds: correctOptions.map((option) => option.id),
        correctOptionLabels: correctOptions.map((option) => option.label),
        isCorrect: answer?.isCorrect ?? null
      };
    });

    return {
      id: result.id,
      organizationId: result.organizationId,
      attemptId: result.attemptId,
      quizId: result.quizId,
      userId: result.userId,
      totalPoints: result.totalPoints,
      earnedPoints: result.earnedPoints,
      percentage: result.percentage,
      passed: result.passed,
      createdAt: result.createdAt,
      answerReview
    };
  }

  async getPublicQuiz(input: { quizId: string; token: string }) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      include: {
        questions: {
          include: {
            answerOptions: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });
    if (!quiz || quiz.status !== QuizStatus.PUBLISHED) {
      throw new NotFoundException('Published quiz not found');
    }
    if (!quiz.publicAccessEnabled || !quiz.publicAccessToken || quiz.publicAccessToken !== input.token) {
      throw new ForbiddenException('Public access is not enabled for this quiz');
    }

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      passScore: quiz.passScore,
      questionFlowMode: quiz.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP',
      showAnswerFeedback: quiz.showAnswerFeedback,
      publicAccessMode: quiz.publicAccessMode ?? 'PUBLIC_LINK',
      requiresPassword: (quiz.publicAccessMode ?? 'PUBLIC_LINK') === 'PASSWORD',
      requiresApprovedEmail: (quiz.publicAccessMode ?? 'PUBLIC_LINK') === 'APPROVAL',
      endForm: {
        enabled: quiz.endFormEnabled,
        requireSubmit: quiz.endFormRequireSubmit,
        title: quiz.endFormTitle ?? 'Stay Connected',
        description: quiz.endFormDescription ?? 'Leave your details to continue.',
        submitLabel: quiz.endFormSubmitLabel ?? 'Submit',
        fields: Array.isArray(quiz.endFormFields)
          ? quiz.endFormFields
          : [
              { type: 'text', key: 'name', label: 'Name', placeholder: 'Your name', required: false },
              { type: 'email', key: 'email', label: 'Email', placeholder: 'you@example.com', required: false }
            ]
      },
      questions: quiz.questions.map((question) => {
        const metadata =
          question.metadata && typeof question.metadata === 'object'
            ? (question.metadata as Record<string, unknown>)
            : {};

        return {
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          explanation: question.explanation,
          imageUrl: typeof metadata.imageUrl === 'string' ? metadata.imageUrl : null,
          points: question.points,
          position: question.position,
          correctOptionIds: quiz.showAnswerFeedback
            ? question.answerOptions.filter((option) => option.isCorrect).map((option) => option.id)
            : [],
          answerOptions: question.answerOptions.map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
            position: option.position
          }))
        };
      })
    };
  }

  async submitPublicEndForm(input: { attemptId: string; values: Record<string, unknown> }) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: input.attemptId },
      include: {
        quiz: {
          select: {
            id: true,
            organizationId: true,
            endFormEnabled: true
          }
        }
      }
    });
    if (!attempt || attempt.userId) {
      throw new NotFoundException('Public attempt not found');
    }
    if (attempt.status !== AttemptStatus.SUBMITTED) {
      throw new BadRequestException('Submit quiz before end form');
    }
    if (!attempt.quiz.endFormEnabled) {
      throw new BadRequestException('End form is not enabled for this quiz');
    }

    const values = input.values ?? {};
    const name = typeof values.name === 'string' ? values.name : null;
    const email = typeof values.email === 'string' ? values.email : null;
    const phone = typeof values.phone === 'string' ? values.phone : null;

    const saved = await this.prisma.leadSubmission.upsert({
      where: {
        attemptId: attempt.id
      },
      update: {
        name,
        email,
        phone,
        payload: values as Prisma.InputJsonValue
      },
      create: {
        organizationId: attempt.quiz.organizationId,
        quizId: attempt.quiz.id,
        attemptId: attempt.id,
        name,
        email,
        phone,
        payload: values as Prisma.InputJsonValue
      }
    });

    return {
      id: saved.id,
      createdAt: saved.createdAt
    };
  }

  private gradeQuestion(
    type: QuestionType,
    points: number,
    payload: Record<string, unknown> | undefined,
    options: Array<{ id: string; isCorrect: boolean }>
  ): { isCorrect: boolean | null; pointsAwarded: number } {
    if (!payload) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    if (type === QuestionType.SHORT_TEXT) {
      return { isCorrect: null, pointsAwarded: 0 };
    }

    const selected = payload.selectedOptionIds;
    if (!Array.isArray(selected)) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id).sort();
    const selectedIds = selected.filter((v): v is string => typeof v === 'string').sort();

    const isCorrect =
      correctIds.length === selectedIds.length && correctIds.every((value, idx) => value === selectedIds[idx]);
    return {
      isCorrect,
      pointsAwarded: isCorrect ? points : 0
    };
  }

  private async resolveAssignmentAccess(input: {
    organizationId: string;
    quizId: string;
    userId: string;
  }) {
    const assignments = await this.prisma.quizAssignment.findMany({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId
      },
      include: { targets: true }
    });

    if (assignments.length === 0) {
      return null;
    }

    const classMemberships = await this.prisma.classMembership.findMany({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        memberType: ClassMemberType.STUDENT
      },
      select: {
        classId: true
      }
    });
    const classIds = new Set(classMemberships.map((membership) => membership.classId));

    const now = new Date();
    for (const assignment of assignments) {
      if (assignment.startAt && assignment.startAt > now) {
        continue;
      }
      if (assignment.endAt && assignment.endAt < now) {
        continue;
      }

      if (
        assignment.scopeType === AssignmentScopeType.PUBLIC_LINK ||
        assignment.scopeType === AssignmentScopeType.EMBED_PUBLIC ||
        assignment.scopeType === AssignmentScopeType.SCHOOL_WIDE
      ) {
        return assignment;
      }

      const hasDirectTarget = assignment.targets.some((target) => target.userId === input.userId);
      if (hasDirectTarget) {
        return assignment;
      }

      const hasClassTarget = assignment.targets.some(
        (target) => target.classId && classIds.has(target.classId)
      );
      if (hasClassTarget) {
        return assignment;
      }
    }

    return null;
  }

  private async assertMembership(organizationId: string, userId: string) {
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
      return null;
    }

    return membership;
  }
}
