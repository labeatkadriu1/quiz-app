-- DropForeignKey
ALTER TABLE "LeadSubmission" DROP CONSTRAINT "LeadSubmission_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "LeadSubmission" DROP CONSTRAINT "LeadSubmission_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "LeadSubmission" DROP CONSTRAINT "LeadSubmission_quizId_fkey";

-- DropForeignKey
ALTER TABLE "LeadSubmission" DROP CONSTRAINT "LeadSubmission_userId_fkey";

-- AlterTable
ALTER TABLE "LeadSubmission" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSubmission" ADD CONSTRAINT "LeadSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
