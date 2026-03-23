CREATE TYPE "ClassMemberType" AS ENUM ('TEACHER', 'STUDENT');
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "QuizVisibility" AS ENUM ('PRIVATE', 'ORG_PUBLIC', 'PUBLIC_LINK', 'EMBED_PUBLIC');
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT');
CREATE TYPE "AssignmentScopeType" AS ENUM ('STUDENT', 'SELECTED_STUDENTS', 'CLASS', 'MULTI_CLASS', 'TEACHER_STUDENTS', 'SCHOOL_WIDE', 'PUBLIC_LINK', 'EMBED_PUBLIC');
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

CREATE TABLE "Class" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "gradeLevel" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Class_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE,
  CONSTRAINT "Class_school_name_key" UNIQUE ("schoolId", "name")
);

CREATE TABLE "ClassMembership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "memberType" "ClassMemberType" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ClassMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassMembership_class_user_type_key" UNIQUE ("classId", "userId", "memberType")
);

CREATE TABLE "Quiz" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "QuizVisibility" NOT NULL DEFAULT 'PRIVATE',
  "passScore" INTEGER NOT NULL DEFAULT 0,
  "attemptLimitDefault" INTEGER,
  "timeLimitSeconds" INTEGER,
  "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
  "shuffleAnswers" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Quiz_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Quiz_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE TABLE "Question" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId" UUID NOT NULL,
  "type" "QuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "explanation" TEXT,
  "points" INTEGER NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "Question_quiz_position_key" UNIQUE ("quizId", "position")
);

CREATE TABLE "AnswerOption" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "questionId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE,
  CONSTRAINT "AnswerOption_question_position_key" UNIQUE ("questionId", "position")
);

CREATE TABLE "QuizAssignment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "quizId" UUID NOT NULL,
  "assignedById" UUID NOT NULL,
  "scopeType" "AssignmentScopeType" NOT NULL,
  "startAt" TIMESTAMPTZ,
  "endAt" TIMESTAMPTZ,
  "attemptLimit" INTEGER,
  "passScoreOverride" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "QuizAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAssignment_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE TABLE "QuizAssignmentTarget" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignmentId" UUID NOT NULL,
  "targetType" TEXT NOT NULL,
  "userId" UUID,
  "classId" UUID,
  "schoolId" UUID,
  CONSTRAINT "QuizAssignmentTarget_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "QuizAssignment"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAssignmentTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAssignmentTarget_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAssignmentTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE
);

CREATE TABLE "QuizAttempt" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "quizId" UUID NOT NULL,
  "assignmentId" UUID,
  "userId" UUID,
  "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "submittedAt" TIMESTAMPTZ,
  "score" INTEGER,
  "percentage" DOUBLE PRECISION,
  "timeSpentSec" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "QuizAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "QuizAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "QuizAssignment"("id") ON DELETE SET NULL,
  CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE TABLE "AttemptAnswer" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "attemptId" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "answerPayload" JSONB NOT NULL,
  "isCorrect" BOOLEAN,
  "pointsAwarded" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE,
  CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE,
  CONSTRAINT "AttemptAnswer_attempt_question_key" UNIQUE ("attemptId", "questionId")
);

CREATE TABLE "Result" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "attemptId" UUID NOT NULL UNIQUE,
  "quizId" UUID NOT NULL,
  "userId" UUID,
  "totalPoints" INTEGER NOT NULL,
  "earnedPoints" INTEGER NOT NULL,
  "percentage" DOUBLE PRECISION NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Result_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Result_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE,
  CONSTRAINT "Result_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "Result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "Class_organization_school_idx" ON "Class"("organizationId", "schoolId");
CREATE INDEX "ClassMembership_org_user_type_idx" ON "ClassMembership"("organizationId", "userId", "memberType");
CREATE INDEX "Quiz_org_status_idx" ON "Quiz"("organizationId", "status");
CREATE INDEX "Quiz_org_publishedAt_idx" ON "Quiz"("organizationId", "publishedAt");
CREATE INDEX "Question_quiz_type_idx" ON "Question"("quizId", "type");
CREATE INDEX "AnswerOption_question_correct_idx" ON "AnswerOption"("questionId", "isCorrect");
CREATE INDEX "QuizAssignment_org_quiz_idx" ON "QuizAssignment"("organizationId", "quizId");
CREATE INDEX "QuizAssignment_start_end_idx" ON "QuizAssignment"("startAt", "endAt");
CREATE INDEX "QuizAssignmentTarget_assignment_targetType_idx" ON "QuizAssignmentTarget"("assignmentId", "targetType");
CREATE INDEX "QuizAssignmentTarget_userId_idx" ON "QuizAssignmentTarget"("userId");
CREATE INDEX "QuizAssignmentTarget_classId_idx" ON "QuizAssignmentTarget"("classId");
CREATE INDEX "QuizAssignmentTarget_schoolId_idx" ON "QuizAssignmentTarget"("schoolId");
CREATE INDEX "QuizAttempt_org_quiz_user_idx" ON "QuizAttempt"("organizationId", "quizId", "userId");
CREATE INDEX "QuizAttempt_status_submittedAt_idx" ON "QuizAttempt"("status", "submittedAt");
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");
CREATE INDEX "Result_org_quiz_idx" ON "Result"("organizationId", "quizId");
CREATE INDEX "Result_org_user_idx" ON "Result"("organizationId", "userId");
