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
    contentType?: string;
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
        shuffleAnswers: input.shuffleAnswers ?? false,
        contentType: input.contentType ?? 'QUIZ'
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
    const editableQuiz = await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const questionCount = await this.prisma.question.count({
      where: { quizId: input.quizId }
    });
    if ((editableQuiz.contentType ?? 'QUIZ') === 'FORM') {
      const hasEndFormFields = Array.isArray(editableQuiz.endFormFields) && editableQuiz.endFormFields.length > 0;
      if (!editableQuiz.endFormEnabled || !hasEndFormFields) {
        throw new BadRequestException('FORM type requires End Form enabled with at least one field');
      }
    } else if ((editableQuiz.contentType ?? 'QUIZ') === 'PREDICTOR') {
      const predictor = this.toPredictorConfig(editableQuiz.themeConfig);
      if (!predictor.leftTeamName.trim() || !predictor.rightTeamName.trim()) {
        throw new BadRequestException('PREDICTOR type requires both team names');
      }
    } else if (questionCount === 0) {
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
    const requestAccessToken =
      input.scopeType === AssignmentScopeType.REQUEST_LINK ? randomBytes(16).toString('hex') : null;

    const created = await this.prisma.quizAssignment.create({
      data: {
        organizationId: input.organizationId,
        quizId: input.quizId,
        assignedById: input.actorUserId,
        scopeType: input.scopeType,
        startAt: input.startAt,
        endAt: input.endAt,
        attemptLimit: input.attemptLimit,
        passScoreOverride: input.passScoreOverride,
        requestAccessToken,
        targets: {
          create: normalizedTargets
        }
      },
      include: {
        targets: true
      }
    });

    return {
      ...created,
      requestUrl: this.toRequestAccessUrl(created.requestAccessToken)
    };
  }

  async listAssignmentsForQuiz(input: { organizationId: string; quizId: string; actorUserId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const assignments = await this.prisma.quizAssignment.findMany({
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

    return assignments.map((assignment) => ({
      ...assignment,
      requestUrl: this.toRequestAccessUrl(assignment.requestAccessToken)
    }));
  }

  async listAssignmentRequests(input: {
    organizationId: string;
    quizId: string;
    assignmentId: string;
    actorUserId: string;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const assignment = await this.prisma.quizAssignment.findFirst({
      where: {
        id: input.assignmentId,
        quizId: input.quizId,
        organizationId: input.organizationId
      }
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.assignmentAccessRequest.findMany({
      where: {
        organizationId: input.organizationId,
        quizId: input.quizId,
        assignmentId: input.assignmentId
      },
      include: {
        reviewedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });
  }

  async reviewAssignmentRequest(input: {
    organizationId: string;
    quizId: string;
    assignmentId: string;
    requestId: string;
    actorUserId: string;
    action: 'APPROVE' | 'REJECT';
    note?: string;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const request = await this.prisma.assignmentAccessRequest.findFirst({
      where: {
        id: input.requestId,
        assignmentId: input.assignmentId,
        quizId: input.quizId,
        organizationId: input.organizationId
      }
    });
    if (!request) {
      throw new NotFoundException('Assignment request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request has already been reviewed');
    }

    return this.prisma.assignmentAccessRequest.update({
      where: { id: request.id },
      data: {
        status: input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: input.actorUserId,
        reviewedNote: input.note?.trim() || null
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

  async deleteQuiz(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const deleted = await this.prisma.quiz.delete({
      where: { id: input.quizId },
      select: { id: true, title: true }
    });

    return {
      deleted: true,
      quizId: deleted.id,
      title: deleted.title
    };
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
      options?: string[];
    }>;
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const sanitizedFields = (input.fields ?? [])
      .map((field) => ({
        type: field.type?.trim(),
        label: field.label?.trim(),
        key: field.key?.trim(),
        placeholder: field.placeholder?.trim() || '',
        required: Boolean(field.required),
        options: Array.isArray(field.options)
          ? field.options.map((option) => option.trim()).filter((option) => option.length > 0)
          : []
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
            phone: true,
            payload: true
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
        predictorSubmission:
          attempt.leadSubmission?.payload &&
          typeof attempt.leadSubmission.payload === 'object' &&
          (attempt.leadSubmission.payload as Record<string, unknown>).predictor &&
          typeof (attempt.leadSubmission.payload as Record<string, unknown>).predictor === 'object'
            ? ((attempt.leadSubmission.payload as Record<string, unknown>).predictor as Record<string, unknown>)
            : null,
        formSubmission:
          attempt.leadSubmission?.payload &&
          typeof attempt.leadSubmission.payload === 'object' &&
          !(attempt.leadSubmission.payload as Record<string, unknown>).predictor
            ? (attempt.leadSubmission.payload as Record<string, unknown>)
            : null,
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

  async configureQuizTheme(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    theme: {
      backgroundColor?: string;
      backgroundGradient?: string;
      cardColor?: string;
      textColor?: string;
      mutedTextColor?: string;
      primaryColor?: string;
      primaryTextColor?: string;
      correctColor?: string;
      wrongColor?: string;
      fontFamily?: string;
    };
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);

    const current = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: { themeConfig: true }
    });

    const base =
      current?.themeConfig && typeof current.themeConfig === 'object'
        ? (current.themeConfig as Record<string, unknown>)
        : {};

    const sanitized: Record<string, string> = {};
    const keys = [
      'backgroundColor',
      'backgroundGradient',
      'cardColor',
      'textColor',
      'mutedTextColor',
      'primaryColor',
      'primaryTextColor',
      'correctColor',
      'wrongColor',
      'fontFamily'
    ] as const;

    for (const key of keys) {
      const value = input.theme[key];
      if (typeof value === 'string' && value.trim()) {
        sanitized[key] = value.trim();
      }
    }

    const merged = {
      ...base,
      ...sanitized
    };

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        themeConfig: merged as Prisma.InputJsonValue
      },
      select: {
        id: true,
        themeConfig: true
      }
    });

    return {
      quizId: updated.id,
      theme: this.toQuizTheme(updated.themeConfig)
    };
  }

  async configureContentType(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    contentType: string;
  }) {
    const quiz = await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestException('Content type can only be changed in DRAFT status');
    }

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        contentType: input.contentType
      },
      select: {
        id: true,
        contentType: true
      }
    });

    return {
      quizId: updated.id,
      contentType: updated.contentType
    };
  }

  async configurePredictorConfig(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    config: {
      badgeText?: string;
      titleText?: string;
      leftTeamName?: string;
      rightTeamName?: string;
      leftTeamLogoUrl?: string;
      rightTeamLogoUrl?: string;
      leftScore?: number;
      rightScore?: number;
      minScore?: number;
      maxScore?: number;
      step?: number;
    };
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const current = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: { themeConfig: true }
    });
    const base =
      current?.themeConfig && typeof current.themeConfig === 'object'
        ? (current.themeConfig as Record<string, unknown>)
        : {};

    const currentConfig = this.toPredictorConfig(base);
    const merged = {
      ...currentConfig,
      ...(typeof input.config.badgeText === 'string' ? { badgeText: input.config.badgeText.trim() } : {}),
      ...(typeof input.config.titleText === 'string' ? { titleText: input.config.titleText.trim() } : {}),
      ...(typeof input.config.leftTeamName === 'string' ? { leftTeamName: input.config.leftTeamName.trim() } : {}),
      ...(typeof input.config.rightTeamName === 'string' ? { rightTeamName: input.config.rightTeamName.trim() } : {}),
      ...(typeof input.config.leftTeamLogoUrl === 'string' ? { leftTeamLogoUrl: input.config.leftTeamLogoUrl.trim() } : {}),
      ...(typeof input.config.rightTeamLogoUrl === 'string' ? { rightTeamLogoUrl: input.config.rightTeamLogoUrl.trim() } : {}),
      ...(typeof input.config.leftScore === 'number' ? { leftScore: input.config.leftScore } : {}),
      ...(typeof input.config.rightScore === 'number' ? { rightScore: input.config.rightScore } : {}),
      ...(typeof input.config.minScore === 'number' ? { minScore: input.config.minScore } : {}),
      ...(typeof input.config.maxScore === 'number' ? { maxScore: input.config.maxScore } : {}),
      ...(typeof input.config.step === 'number' ? { step: input.config.step } : {})
    };

    const minScore = Math.min(merged.minScore, merged.maxScore);
    const maxScore = Math.max(merged.minScore, merged.maxScore);
    const step = Math.max(1, Math.round(merged.step || 1));
    const clamp = (value: number) => Math.max(minScore, Math.min(maxScore, Math.round(value)));

    const normalized = {
      ...merged,
      minScore,
      maxScore,
      step,
      leftScore: clamp(merged.leftScore),
      rightScore: clamp(merged.rightScore)
    };

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        themeConfig: {
          ...base,
          predictorConfig: normalized
        } as Prisma.InputJsonValue
      },
      select: {
        id: true,
        themeConfig: true
      }
    });

    return {
      quizId: updated.id,
      predictorConfig: this.toPredictorConfig(updated.themeConfig)
    };
  }

  async getPredictorConfig(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: {
        id: true,
        themeConfig: true
      }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      quizId: quiz.id,
      predictorConfig: this.toPredictorConfig(quiz.themeConfig)
    };
  }

  async getQuizTheme(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: {
        id: true,
        themeConfig: true
      }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      quizId: quiz.id,
      theme: this.toQuizTheme(quiz.themeConfig)
    };
  }

  async configureStartScreen(input: {
    organizationId: string;
    actorUserId: string;
    quizId: string;
    config: {
      enabled?: boolean;
      mode?: 'DEFAULT' | 'CUSTOM';
      showGlassCard?: boolean;
      title?: string;
      description?: string;
      buttonLabel?: string;
      introHtml?: string;
      coverImageUrl?: string;
    };
  }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const current = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: { themeConfig: true, title: true, description: true }
    });
    if (!current) {
      throw new NotFoundException('Quiz not found');
    }

    const base =
      current.themeConfig && typeof current.themeConfig === 'object'
        ? (current.themeConfig as Record<string, unknown>)
        : {};

    const currentConfig = this.toStartScreenConfig(current.themeConfig, current.title, current.description);
    const merged = {
      ...currentConfig,
      ...(typeof input.config.enabled === 'boolean' ? { enabled: input.config.enabled } : {}),
      ...(typeof input.config.mode === 'string' ? { mode: input.config.mode } : {}),
      ...(typeof input.config.showGlassCard === 'boolean' ? { showGlassCard: input.config.showGlassCard } : {}),
      ...(typeof input.config.title === 'string' ? { title: input.config.title.trim() } : {}),
      ...(typeof input.config.description === 'string' ? { description: input.config.description.trim() } : {}),
      ...(typeof input.config.buttonLabel === 'string' ? { buttonLabel: input.config.buttonLabel.trim() } : {}),
      ...(typeof input.config.introHtml === 'string' ? { introHtml: input.config.introHtml.trim() } : {}),
      ...(typeof input.config.coverImageUrl === 'string' ? { coverImageUrl: input.config.coverImageUrl.trim() } : {})
    };

    if (merged.mode !== 'CUSTOM') {
      merged.mode = 'DEFAULT';
    }

    const updated = await this.prisma.quiz.update({
      where: { id: input.quizId },
      data: {
        themeConfig: {
          ...base,
          startScreenConfig: merged
        } as Prisma.InputJsonValue
      },
      select: {
        id: true,
        title: true,
        description: true,
        themeConfig: true
      }
    });

    return {
      quizId: updated.id,
      startScreenConfig: this.toStartScreenConfig(updated.themeConfig, updated.title, updated.description)
    };
  }

  async getStartScreen(input: { organizationId: string; actorUserId: string; quizId: string }) {
    await this.assertCanEditQuiz(input.organizationId, input.quizId, input.actorUserId);
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: input.quizId },
      select: {
        id: true,
        title: true,
        description: true,
        themeConfig: true
      }
    });
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return {
      quizId: quiz.id,
      startScreenConfig: this.toStartScreenConfig(quiz.themeConfig, quiz.title, quiz.description)
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

  private toRequestAccessUrl(token: string | null) {
    if (!token) {
      return null;
    }
    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    return `${webUrl}/request-assignment/${token}`;
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

    if (scopeType === AssignmentScopeType.REQUEST_LINK) {
      return [{ targetType: AssignmentScopeType.REQUEST_LINK }];
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

  private toQuizTheme(themeConfig: unknown) {
    const raw = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
    const get = (key: string, fallback: string) => (typeof raw[key] === 'string' && raw[key] ? String(raw[key]) : fallback);

    return {
      backgroundColor: get('backgroundColor', '#f3f6ff'),
      backgroundGradient: get('backgroundGradient', 'linear-gradient(135deg, #f3f6ff 0%, #eef8ff 50%, #f9f4ff 100%)'),
      cardColor: get('cardColor', '#ffffff'),
      textColor: get('textColor', '#0f172a'),
      mutedTextColor: get('mutedTextColor', '#475569'),
      primaryColor: get('primaryColor', '#0f766e'),
      primaryTextColor: get('primaryTextColor', '#ffffff'),
      correctColor: get('correctColor', '#16a34a'),
      wrongColor: get('wrongColor', '#dc2626'),
      fontFamily: get('fontFamily', '"Avenir Next", "Segoe UI", sans-serif')
    };
  }

  private toPredictorConfig(themeConfig: unknown) {
    const raw = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
    const source =
      raw.predictorConfig && typeof raw.predictorConfig === 'object'
        ? (raw.predictorConfig as Record<string, unknown>)
        : {};

    const getString = (key: string, fallback: string) =>
      typeof source[key] === 'string' && String(source[key]).trim().length > 0 ? String(source[key]).trim() : fallback;
    const getInt = (key: string, fallback: number) => {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(value);
      }
      if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
        return Math.round(Number(value));
      }
      return fallback;
    };

    const minScore = Math.min(getInt('minScore', 0), getInt('maxScore', 10));
    const maxScore = Math.max(getInt('minScore', 0), getInt('maxScore', 10));
    const step = Math.max(1, getInt('step', 1));
    const clamp = (value: number) => Math.max(minScore, Math.min(maxScore, value));

    return {
      badgeText: getString('badgeText', 'GUESS THE SCORE'),
      titleText: getString('titleText', 'Predictor'),
      leftTeamName: getString('leftTeamName', 'Team 1'),
      rightTeamName: getString('rightTeamName', 'Team 2'),
      leftTeamLogoUrl: getString('leftTeamLogoUrl', ''),
      rightTeamLogoUrl: getString('rightTeamLogoUrl', ''),
      minScore,
      maxScore,
      step,
      leftScore: clamp(getInt('leftScore', 0)),
      rightScore: clamp(getInt('rightScore', 0))
    };
  }

  private toStartScreenConfig(themeConfig: unknown, quizTitle: string, quizDescription: string | null) {
    const raw = themeConfig && typeof themeConfig === 'object' ? (themeConfig as Record<string, unknown>) : {};
    const source =
      raw.startScreenConfig && typeof raw.startScreenConfig === 'object'
        ? (raw.startScreenConfig as Record<string, unknown>)
        : {};

    const getString = (key: string, fallback: string) =>
      typeof source[key] === 'string' && String(source[key]).trim().length > 0 ? String(source[key]).trim() : fallback;

    return {
      enabled: typeof source.enabled === 'boolean' ? source.enabled : false,
      mode: source.mode === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT',
      showGlassCard: typeof source.showGlassCard === 'boolean' ? source.showGlassCard : false,
      title: getString('title', quizTitle),
      description: getString('description', quizDescription ?? 'Start when you are ready.'),
      buttonLabel: getString('buttonLabel', 'Start Quiz'),
      introHtml: getString('introHtml', ''),
      coverImageUrl: getString('coverImageUrl', '')
    };
  }
}
