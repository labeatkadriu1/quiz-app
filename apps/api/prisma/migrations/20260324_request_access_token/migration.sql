-- AlterEnum
ALTER TYPE "AssignmentScopeType" ADD VALUE 'REQUEST_LINK';

-- AlterTable
ALTER TABLE "QuizAssignment" ADD COLUMN     "requestAccessToken" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AssignmentAccessRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewedNote" TEXT,

    CONSTRAINT "AssignmentAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentAccessRequest_organizationId_assignmentId_status_idx" ON "AssignmentAccessRequest"("organizationId", "assignmentId", "status");

-- CreateIndex
CREATE INDEX "AssignmentAccessRequest_email_status_idx" ON "AssignmentAccessRequest"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAssignment_requestAccessToken_key" ON "QuizAssignment"("requestAccessToken");

-- CreateIndex
CREATE INDEX "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");

-- AddForeignKey
ALTER TABLE "AssignmentAccessRequest" ADD CONSTRAINT "AssignmentAccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAccessRequest" ADD CONSTRAINT "AssignmentAccessRequest_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAccessRequest" ADD CONSTRAINT "AssignmentAccessRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "QuizAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAccessRequest" ADD CONSTRAINT "AssignmentAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

