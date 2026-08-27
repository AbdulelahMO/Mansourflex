-- AlterTable
ALTER TABLE "buildings" ADD COLUMN "additionalNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "areaSqm" REAL;
ALTER TABLE "buildings" ADD COLUMN "blockNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "buildingNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "complexName" TEXT;
ALTER TABLE "buildings" ADD COLUMN "constructionDate" DATETIME;
ALTER TABLE "buildings" ADD COLUMN "country" TEXT;
ALTER TABLE "buildings" ADD COLUMN "deedFileUrl" TEXT;
ALTER TABLE "buildings" ADD COLUMN "deedIssueDate" DATETIME;
ALTER TABLE "buildings" ADD COLUMN "deedNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "deedType" TEXT;
ALTER TABLE "buildings" ADD COLUMN "electricityMeterNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "electricitySubscriptionNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "floorsCount" INTEGER;
ALTER TABLE "buildings" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "buildings" ADD COLUMN "plotNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "buildings" ADD COLUMN "propertyNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "propertyType" TEXT;
ALTER TABLE "buildings" ADD COLUMN "region" TEXT;
ALTER TABLE "buildings" ADD COLUMN "sector" TEXT;
ALTER TABLE "buildings" ADD COLUMN "streetName" TEXT;
ALTER TABLE "buildings" ADD COLUMN "unitsPerFloor" INTEGER;
ALTER TABLE "buildings" ADD COLUMN "usageType" TEXT;
ALTER TABLE "buildings" ADD COLUMN "waterMeterNumber" TEXT;
ALTER TABLE "buildings" ADD COLUMN "waterSubscriptionNumber" TEXT;

-- CreateTable
CREATE TABLE "building_contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "building_contacts_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
