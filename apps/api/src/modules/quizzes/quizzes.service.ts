import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentScopeType,
  MemberStatus,
  Prisma,
  QuestionType,
  QuizStatus,
  QuizVisibility
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuiz(input: {
    organizationId: string;
    ownerUserId: string;
    title: string;
    description?: string;
    visibility?: QuizVisibility;
    passScore?: number;
    timeLimitSeconds?: number;
    attemptLimitDefault?: number;
    shuffleQuestions?: boolean;
    shuffleAnswers?: boolean;
  }) {
    await this.assertActiveMembership(input.organizationId, input.ownerUserId);

    return this.prisma.quiz.create({
      data: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        title: input.title,
        description: input.description,
        visibility: input.visibility ?? QuizVisibility.PRIVATE,
        passScore: input.passScore ?? 0,
        timeLimitSeconds: input.timeLimitSeconds,
        attemptLimitDefault: input.attemptLimitDefault,
        shuffleQuestions: input.shuffleQuestions ?? false,
        shuffleAnswers: input.shuffleAnswers ?? false
      }
    });
  }

  async addQuestion(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    type: QuestionType;
    prompt: string;
    explanation?: string;
    imageUrl?: string;
    points: number;
    position: number;
    options?: Array<{ label: string; value: string; isCorrect?: boolean }>;
  }) {
    const quiz = await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestException('Questions can only be added while quiz is in DRAFT');
    }

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          quizId: input.quizId,
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation,
          metadata: input.imageUrl?.trim()
            ? ({ imageUrl: input.imageUrl.trim() } as Prisma.InputJsonValue)
            : undefined,
          points: input.points,
          position: input.position
        }
      });

      if (input.options && input.options.length > 0) {
        await tx.answerOption.createMany({
          data: input.options.map((option, idx) => ({
            questionId: question.id,
            label: option.label,
            value: option.value,
            isCorrect: option.isCorrect ?? false,
            position: idx + 1
          }))
        });
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: { answerOptions: true }
      });
    });
  }

  async publishQuiz(input: { organizationId: string; quizId: string; actorUserId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const questionCount = await this.prisma.question.count({
      where: { quizId: input.quizId }
    });
    if (questionCount === 0) {
      throw new BadRequestException('Quiz must contain at least one question');
    }

    return this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        status: QuizStatus.PUBLISHED,
        publishedAt: new Date()
      }
    });
  }

  async createAssignment(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    scopeType: AssignmentScopeType;
    startAt?: Date;
    endAt?: Date;
    attemptLimit?: number;
    passScoreOverride?: number;
    targets: Array<{ targetType: string; userId?: string; classId?: string; schoolId?: string }>;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const normalizedTargets = this.normalizeAssignmentTargets(input.scopeType, input.targets);

    return this.prisma.quizAssignment.create({
      data: {
        organizationId: input.organizationId,
        quizId: input.quizId,
        assignedById: input.actorUserId,
        scopeType: input.scopeType,
        startAt: input.startAt,
        endAt: input.endAt,
        attemptLimit: input.attemptLimit,
        passScoreOverride: input.passScoreOverride,
        targets: {
          create: normalizedTargets
        }
      },
      include: {
        targets: true
      }
    });
  }

  async listAssignmentsForQuiz(input: { organizationId: string; quizId: string; actorUserId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    return this.prisma.quizAssignment.findMany({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId
      },
      include: {
        targets: true,
        assignedBy: {
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
      }
    });
  }

  async updateQuestion(input: {
    organizationId: string;
    actorUserId: string;
    questionId: string;
    prompt: string;
    explanation?: string;
    imageUrl?: string;
    points: number;
    options?: Array<{ label: string; value: string; isCorrect?: boolean }>;
  }) {
    const question = await this.prisma.question.findUnique({
      where: { id: input.questionId },
      include: { quiz: true }
    });
    if (!question || question.quiz.organizationId !== input.organizationId) {
      throw new NotFoundException('Question not found');
    }

    const quiz = await this.assertCanEditQuiz(input.organizationId, question.quizId, input.actorUserId);
    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quiz questions can be edited');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: question.id },
        data: {
          prompt: input.prompt,
          explanation: input.explanation,
          metadata: input.imageUrl?.trim()
            ? ({ imageUrl: input.imageUrl.trim() } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          points: input.points
        }
      });

      if (input.options) {
        await tx.answerOption.deleteMany({
          where: { questionId: question.id }
        });

        if (input.options.length > 0) {
          await tx.answerOption.createMany({
            data: input.options.map((option, idx) => ({
              questionId: question.id,
              label: option.label,
              value: option.value,
              isCorrect: option.isCorrect ?? false,
              position: idx + 1
            }))
          });
        }
      }

      return tx.question.findUnique({
        where: { id: question.id },
        include: { answerOptions: true }
      });
    });
  }

  async deleteQuestion(input: {
    organizationId: string;
    actorUserId: string;
    questionId: string;
  }) {
    const question = await this.prisma.question.findUnique({
      where: { id: input.questionId },
      include: { quiz: true }
    });
    if (!question || question.quiz.organizationId !== input.organizationId) {
      throw new NotFoundException('Question not found');
    }

    const quiz = await this.assertCanEditQuiz(input.organizationId, question.quizId, input.actorUserId);
    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quiz questions can be deleted');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.question.delete({
        where: { id: question.id }
      });

      const remaining = await tx.question.findMany({
        where: { quizId: question.quizId },
        orderBy: { position: 'asc' }
      });

      for (let i = 0; i < remaining.length; i += 1) {
        const nextPosition = i + 1;
        if (remaining[i].position !== nextPosition) {
          await tx.question.update({
            where: { id: remaining[i].id },
            data: { position: nextPosition }
          });
        }
      }
    });

    return { deleted: true, questionId: question.id };
  }

  async reorderQuestions(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    questionIds: string[];
  }) {
    const quiz = await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quiz questions can be reordered');
    }

    const existing = await this.prisma.question.findMany({
      where: { quizId: input.quizId },
      select: { id: true }
    });
    const existingIds = existing.map((question) => question.id).sort();
    const requestedIds = [...input.questionIds].sort();
    if (existingIds.length !== requestedIds.length || !existingIds.every((id, idx) => id === requestedIds[idx])) {
      throw new BadRequestException('questionIds must include all quiz question IDs exactly once');
    }

    await this.prisma.$transaction(async (tx) => {
      for (let idx = 0; idx < input.questionIds.length; idx += 1) {
        await tx.question.update({
          where: { id: input.questionIds[idx] },
          data: { position: idx + 1 }
        });
      }
    });

    return { reordered: true };
  }

  async configurePublicAccess(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    enabled: boolean;
    mode?: 'PUBLIC_LINK' | 'APPROVAL' | 'PASSWORD';
    password?: string;
    approvedEmails?: string[];
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({ where: { id: input.quizId } });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (!input.enabled) {
      const updated = await this.prisma.quiz.update({
        where: { id: input.quizId },
        data: {
          publicAccessEnabled: false,
          publicAccessMode: null,
          publicAccessToken: null,
          publicAccessPasswordHash: null,
          publicAccessApprovedEmails: Prisma.JsonNull
        }
      });
      return this.toPublicAccessResponse(updated);
    }

    const mode = input.mode ?? 'PUBLIC_LINK';
    const token = quiz.publicAccessToken ?? randomBytes(16).toString('hex');
    const approvedEmails =
      mode === 'APPROVAL'
        ? (input.approvedEmails ?? []).map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0)
        : [];

    let passwordHash = quiz.publicAccessPasswordHash;
    if (mode === 'PASSWORD') {
      if (input.password && input.password.length >= 4) {
        passwordHash = await bcrypt.hash(input.password, 10);
      }
      if (!passwordHash) {
        throw new BadRequestException('Password is required for PASSWORD access mode');
      }
    } else {
      passwordHash = null;
    }

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        publicAccessEnabled: true,
        publicAccessMode: mode,
        publicAccessToken: token,
        publicAccessPasswordHash: passwordHash,
        publicAccessApprovedEmails:
          mode === 'APPROVAL' ? (approvedEmails as Prisma.InputJsonValue) : Prisma.JsonNull
      }
    });

    return this.toPublicAccessResponse(updated);
  }

  async getPublicAccessSettings(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return this.toPublicAccessResponse(quiz);
  }

  async configureEndForm(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    enabled: boolean;
    requireSubmit?: boolean;
    title?: string;
    description?: string;
    submitLabel?: string;
    fields?: Array<{
      type: string;
      label: string;
      key: string;
      placeholder?: string;
      required?: boolean;
    }>;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const sanitizedFields = (input.fields ?? [])
      .map((field) => ({
        type: field.type?.trim(),
        label: field.label?.trim(),
        key: field.key?.trim(),
        placeholder: field.placeholder?.trim() || '',
        required: Boolean(field.required)
      }))
      .filter((field) => field.type && field.label && field.key);

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        endFormEnabled: input.enabled,
        endFormRequireSubmit: input.requireSubmit ?? false,
        endFormTitle: input.title?.trim() || null,
        endFormDescription: input.description?.trim() || null,
        endFormSubmitLabel: input.submitLabel?.trim() || null,
        endFormFields: sanitizedFields as Prisma.InputJsonValue
      }
    });

    return this.toEndFormResponse(updated);
  }

  async getEndForm(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return this.toEndFormResponse(quiz);
  }

  async listEndFormSubmissions(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const submissions = await this.prisma.leadSubmission.findMany({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        attempt: {
          select: {
            id: true,
            submittedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return submissions.map((submission) => ({
      id: submission.id,
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      payload: submission.payload,
      createdAt: submission.createdAt,
      attemptId: submission.attemptId,
      user: submission.user
        ? {
            id: submission.user.id,
            email: submission.user.email,
            name: [submission.user.firstName, submission.user.lastName].filter(Boolean).join(' ').trim() || null
          }
        : null
    }));
  }

  async listQuizzesForOrg(input: { organizationId: string; actorUserId: string }) {
    await this.assertActiveMembership(input.organizationId, input.actorUserId);

    return this.prisma.quiz.findMany({
      where: { organizationId: input.organizationId },
      include: {
        questions: {
          include: { answerOptions: true },
          orderBy: { position: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async listQuizAttemptsDetailed(input: { organizationId: string; quizId: string; actorUserId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: input.quizId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        title: true,
        passScore: true,
        questions: {
          select: {
            id: true,
            position: true,
            type: true,
            prompt: true,
            points: true,
            answerOptions: {
              select: {
                id: true,
                label: true,
                value: true,
                isCorrect: true
              },
              orderBy: {
                position: 'asc'
              }
            }
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        leadSubmission: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        result: true,
        answers: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const questionMap = new Map(quiz.questions.map((question) => [question.id, question]));

    const normalizedAttempts = attempts.map((attempt) => {
      const answerMap = new Map(
        attempt.answers.map((answer) => [answer.questionId, answer])
      );

      const answersByQuestion = quiz.questions.map((question) => {
        const answer = answerMap.get(question.id);
        const payload =
          answer && answer.answerPayload && typeof answer.answerPayload === 'object'
            ? (answer.answerPayload as Record<string, unknown>)
            : null;

        const selectedOptionIds = Array.isArray(payload?.selectedOptionIds)
          ? payload?.selectedOptionIds.filter((value): value is string => typeof value === 'string')
          : [];
        const selectedOptionLabels = selectedOptionIds
          .map((selectedId) => question.answerOptions.find((option) => option.id === selectedId)?.label)
          .filter((label): label is string => Boolean(label));

        const shortTextAnswer =
          typeof payload?.text === 'string'
            ? payload.text
            : typeof payload?.answerText === 'string'
              ? payload.answerText
              : null;

        return {
          questionId: question.id,
          position: question.position,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          correctOptionLabels: question.answerOptions.filter((option) => option.isCorrect).map((option) => option.label),
          selectedOptionIds,
          selectedOptionLabels,
          shortTextAnswer,
          isCorrect: answer?.isCorrect ?? null,
          pointsAwarded: answer?.pointsAwarded ?? 0,
          rawAnswerPayload: answer?.answerPayload ?? null
        };
      });

      return {
        attemptId: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        percentage: attempt.percentage,
        participant: attempt.user
          ? {
              userId: attempt.user.id,
              email: attempt.user.email,
              name: [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(' ').trim() || null
            }
          : attempt.leadSubmission?.email || attempt.leadSubmission?.name
            ? {
                userId: null,
                email: attempt.leadSubmission.email ?? 'Public / Anonymous',
                name: attempt.leadSubmission.name ?? null
              }
            : {
                userId: null,
                email: 'Public / Anonymous',
                name: 'Public / Anonymous'
              },
        result: attempt.result
          ? {
              earnedPoints: attempt.result.earnedPoints,
              totalPoints: attempt.result.totalPoints,
              percentage: attempt.result.percentage,
              passed: attempt.result.passed
            }
          : null,
        answers: answersByQuestion
      };
    });

    const submittedAttempts = normalizedAttempts.filter((attempt) => attempt.status === 'SUBMITTED');
    const questionStats = quiz.questions.map((question) => {
      let answeredCount = 0;
      let correctCount = 0;
      let incorrectCount = 0;

      for (const attempt of submittedAttempts) {
        const answer = attempt.answers.find((item) => item.questionId === question.id);
        if (!answer) {
          continue;
        }
        answeredCount += 1;
        if (answer.isCorrect === true) {
          correctCount += 1;
        } else if (answer.isCorrect === false) {
          incorrectCount += 1;
        }
      }

      const correctRate =
        answeredCount > 0
          ? Number(((correctCount / answeredCount) * 100).toFixed(2))
          : 0;

      return {
        questionId: question.id,
        position: question.position,
        prompt: question.prompt,
        answeredCount,
        correctCount,
        incorrectCount,
        correctRate
      };
    });

    const averageScore =
      submittedAttempts.length > 0
        ? Number(
            (
              submittedAttempts.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) /
              submittedAttempts.length
            ).toFixed(2)
          )
        : 0;

    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        passScore: quiz.passScore,
        questionCount: quiz.questions.length
      },
      summary: {
        totalAttempts: normalizedAttempts.length,
        submittedAttempts: submittedAttempts.length,
        inProgressAttempts: normalizedAttempts.filter((attempt) => attempt.status === 'IN_PROGRESS').length,
        averageScore
      },
      questionStats,
      attempts: normalizedAttempts
    };
  }

  async configureQuizSettings(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    questionFlowMode?: 'STEP_BY_STEP' | 'ALL_AT_ONCE';
    showAnswerFeedback?: boolean;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        questionFlowMode: input.questionFlowMode ?? undefined,
        showAnswerFeedback: typeof input.showAnswerFeedback === 'boolean' ? input.showAnswerFeedback : undefined
      }
    });

    return {
      quizId: updated.id,
      questionFlowMode:
        updated.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP',
      showAnswerFeedback: updated.showAnswerFeedback
    };
  }

  async getQuizSettings(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: {
        id: true,
        questionFlowMode: true,
        showAnswerFeedback: true
      }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      quizId: quiz.id,
      questionFlowMode: quiz.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP',
      showAnswerFeedback: quiz.showAnswerFeedback
    };
  }

  private async assertCanEditQuiz(organizationId: string, quizId: string, userId: string) {
    await this.assertActiveMembership(organizationId, userId);

    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: quizId,
        organizationId
      }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (quiz.ownerUserId !== userId) {
      const adminMembership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId
          }
        },
        include: { role: true }
      });
      if (!adminMembership?.role?.key?.includes('ADMIN')) {
        throw new ForbiddenException('Not allowed to edit this quiz');
      }
    }

    return quiz;
  }

  private toPublicAccessResponse(quiz: {
    id: string;
    publicAccessEnabled: boolean;
    publicAccessMode: string | null;
    publicAccessToken: string | null;
    publicAccessApprovedEmails: unknown;
  }) {
    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    const publicUrl =
      quiz.publicAccessEnabled && quiz.publicAccessToken
        ? `${webUrl}/play/${quiz.id}?token=${quiz.publicAccessToken}`
        : null;

    return {
      quizId: quiz.id,
      enabled: quiz.publicAccessEnabled,
      mode: quiz.publicAccessMode ?? 'PUBLIC_LINK',
      token: quiz.publicAccessToken,
      publicUrl,
      approvedEmails: Array.isArray(quiz.publicAccessApprovedEmails) ? quiz.publicAccessApprovedEmails : []
    };
  }

  private toEndFormResponse(quiz: {
    id: string;
    endFormEnabled: boolean;
    endFormRequireSubmit: boolean;
    endFormTitle: string | null;
    endFormDescription: string | null;
    endFormSubmitLabel: string | null;
    endFormFields: unknown;
  }) {
    return {
      quizId: quiz.id,
      enabled: quiz.endFormEnabled,
      requireSubmit: quiz.endFormRequireSubmit,
      title: quiz.endFormTitle ?? 'Stay Connected',
      description: quiz.endFormDescription ?? 'Leave your details at the end of the quiz.',
      submitLabel: quiz.endFormSubmitLabel ?? 'Submit',
      fields: Array.isArray(quiz.endFormFields)
        ? quiz.endFormFields
        : [
            { type: 'text', key: 'name', label: 'Name', placeholder: 'Your name', required: false },
            { type: 'email', key: 'email', label: 'Email', placeholder: 'you@example.com', required: false }
          ]
    };
  }

  private normalizeAssignmentTargets(
    scopeType: AssignmentScopeType,
    targets: Array<{ targetType: string; userId?: string; classId?: string; schoolId?: string }>
  ) {
    if (scopeType === AssignmentScopeType.PUBLIC_LINK || scopeType === AssignmentScopeType.EMBED_PUBLIC) {
      return [{ targetType: scopeType }];
    }

    if (scopeType === AssignmentScopeType.SCHOOL_WIDE) {
      return [{ targetType: AssignmentScopeType.SCHOOL_WIDE }];
    }

    if (scopeType === AssignmentScopeType.CLASS) {
      const classTargets = targets.filter((target) => Boolean(target.classId));
      if (classTargets.length !== 1) {
        throw new BadRequestException('CLASS assignment requires exactly one class target');
      }
      return [{ targetType: 'CLASS', classId: classTargets[0].classId }];
    }

    if (scopeType === AssignmentScopeType.MULTI_CLASS) {
      const classIds = Array.from(new Set(targets.map((target) => target.classId).filter((id): id is string => Boolean(id))));
      if (classIds.length < 1) {
        throw new BadRequestException('MULTI_CLASS assignment requires one or more class targets');
      }
      return classIds.map((classId) => ({ targetType: 'CLASS', classId }));
    }

    if (scopeType === AssignmentScopeType.STUDENT) {
      const userTargets = targets.filter((target) => Boolean(target.userId));
      if (userTargets.length !== 1) {
        throw new BadRequestException('STUDENT assignment requires exactly one user target');
      }
      return [{ targetType: 'USER', userId: userTargets[0].userId }];
    }

    if (scopeType === AssignmentScopeType.SELECTED_STUDENTS || scopeType === AssignmentScopeType.TEACHER_STUDENTS) {
      const userIds = Array.from(new Set(targets.map((target) => target.userId).filter((id): id is string => Boolean(id))));
      if (userIds.length < 1) {
        throw new BadRequestException(`${scopeType} assignment requires one or more user targets`);
      }
      return userIds.map((userId) => ({ targetType: 'USER', userId }));
    }

    throw new BadRequestException('Unsupported assignment scope');
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
}
