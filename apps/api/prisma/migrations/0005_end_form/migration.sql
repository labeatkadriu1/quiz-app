ALTER TABLE "Quiz"
  ADD COLUMN "endFormEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "endFormRequireSubmit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "endFormTitle" TEXT,
  ADD COLUMN "endFormDescription" TEXT,
  ADD COLUMN "endFormSubmitLabel" TEXT,
  ADD COLUMN "endFormFields" JSONB;

CREATE TABLE "LeadSubmission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "quizId" UUID NOT NULL,
  "attemptId" UUID UNIQUE,
  "userId" UUID,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "LeadSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "LeadSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE,
  CONSTRAINT "LeadSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL,
  CONSTRAINT "LeadSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "LeadSubmission_organizationId_quizId_createdAt_idx" ON "LeadSubmission"("organizationId", "quizId", "createdAt");
CREATE INDEX "LeadSubmission_email_idx" ON "LeadSubmission"("email");
