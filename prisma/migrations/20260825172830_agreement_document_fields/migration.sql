-- AlterTable
ALTER TABLE "management_agreements" ADD COLUMN "signedAt" DATETIME;
ALTER TABLE "management_agreements" ADD COLUMN "signedPlace" TEXT;

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN "nationalAddress" TEXT;
ALTER TABLE "organization_settings" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "organization_settings" ADD COLUMN "signatoryTitle" TEXT;
ALTER TABLE "organization_settings" ADD COLUMN "taxNumber" TEXT;
