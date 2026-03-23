-- DropForeignKey
ALTER TABLE "ClassJoinLink" DROP CONSTRAINT "ClassJoinLink_classId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinLink" DROP CONSTRAINT "ClassJoinLink_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinLink" DROP CONSTRAINT "ClassJoinLink_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinRequest" DROP CONSTRAINT "ClassJoinRequest_classId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinRequest" DROP CONSTRAINT "ClassJoinRequest_joinLinkId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinRequest" DROP CONSTRAINT "ClassJoinRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinRequest" DROP CONSTRAINT "ClassJoinRequest_reviewedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ClassJoinRequest" DROP CONSTRAINT "ClassJoinRequest_studentUserId_fkey";

-- AlterTable
ALTER TABLE "ClassJoinLink" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClassJoinRequest" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "requestedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ClassJoinLink" ADD CONSTRAINT "ClassJoinLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinLink" ADD CONSTRAINT "ClassJoinLink_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinLink" ADD CONSTRAINT "ClassJoinLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinRequest" ADD CONSTRAINT "ClassJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinRequest" ADD CONSTRAINT "ClassJoinRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinRequest" ADD CONSTRAINT "ClassJoinRequest_joinLinkId_fkey" FOREIGN KEY ("joinLinkId") REFERENCES "ClassJoinLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinRequest" ADD CONSTRAINT "ClassJoinRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJoinRequest" ADD CONSTRAINT "ClassJoinRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
