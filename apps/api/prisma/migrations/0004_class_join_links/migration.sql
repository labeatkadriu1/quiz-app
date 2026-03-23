CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ClassJoinLink" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ClassJoinLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassJoinLink_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassJoinLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE TABLE "ClassJoinRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "joinLinkId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "studentUserId" UUID,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMPTZ,
  "reviewedByUserId" UUID,
  "note" TEXT,
  CONSTRAINT "ClassJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassJoinRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassJoinRequest_joinLinkId_fkey" FOREIGN KEY ("joinLinkId") REFERENCES "ClassJoinLink"("id") ON DELETE CASCADE,
  CONSTRAINT "ClassJoinRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "ClassJoinRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "ClassJoinLink_organizationId_classId_idx" ON "ClassJoinLink"("organizationId", "classId");
CREATE INDEX "ClassJoinRequest_organizationId_classId_status_idx" ON "ClassJoinRequest"("organizationId", "classId", "status");
CREATE INDEX "ClassJoinRequest_email_status_idx" ON "ClassJoinRequest"("email", "status");
