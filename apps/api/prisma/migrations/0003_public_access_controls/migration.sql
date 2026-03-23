ALTER TABLE "Quiz"
  ADD COLUMN "publicAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicAccessMode" TEXT,
  ADD COLUMN "publicAccessToken" TEXT,
  ADD COLUMN "publicAccessPasswordHash" TEXT,
  ADD COLUMN "publicAccessApprovedEmails" JSONB;

CREATE UNIQUE INDEX "Quiz_publicAccessToken_key" ON "Quiz"("publicAccessToken");
