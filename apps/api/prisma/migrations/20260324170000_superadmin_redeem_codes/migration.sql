-- CreateTable
CREATE TABLE "RedeemCode" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "percentOff" INTEGER,
  "freePeriodDays" INTEGER,
  "maxRedemptions" INTEGER,
  "maxPerClient" INTEGER NOT NULL DEFAULT 1,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "newSignupsOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemCodeUsage" (
  "id" UUID NOT NULL,
  "redeemCodeId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "appliedByUserId" UUID,
  "discountPercentApplied" INTEGER,
  "freePeriodDaysApplied" INTEGER,
  "metadata" JSONB,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RedeemCodeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_code_key" ON "RedeemCode"("code");
CREATE INDEX "RedeemCode_organizationId_active_idx" ON "RedeemCode"("organizationId", "active");
CREATE INDEX "RedeemCode_validUntil_active_idx" ON "RedeemCode"("validUntil", "active");
CREATE INDEX "RedeemCodeUsage_redeemCodeId_usedAt_idx" ON "RedeemCodeUsage"("redeemCodeId", "usedAt");
CREATE INDEX "RedeemCodeUsage_organizationId_usedAt_idx" ON "RedeemCodeUsage"("organizationId", "usedAt");

-- AddForeignKey
ALTER TABLE "RedeemCode"
  ADD CONSTRAINT "RedeemCode_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RedeemCode"
  ADD CONSTRAINT "RedeemCode_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RedeemCodeUsage"
  ADD CONSTRAINT "RedeemCodeUsage_redeemCodeId_fkey"
  FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RedeemCodeUsage"
  ADD CONSTRAINT "RedeemCodeUsage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RedeemCodeUsage"
  ADD CONSTRAINT "RedeemCodeUsage_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
