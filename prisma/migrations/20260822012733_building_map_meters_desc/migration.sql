/*
  Warnings:

  - You are about to drop the column `electricityMeterNumber` on the `buildings` table. All the data in the column will be lost.
  - You are about to drop the column `electricitySubscriptionNumber` on the `buildings` table. All the data in the column will be lost.
  - You are about to drop the column `waterMeterNumber` on the `buildings` table. All the data in the column will be lost.
  - You are about to drop the column `waterSubscriptionNumber` on the `buildings` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "building_meters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "meterNumber" TEXT,
    "subscriptionNumber" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "building_meters_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_buildings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sector" TEXT,
    "usageType" TEXT,
    "propertyType" TEXT,
    "propertyNumber" TEXT,
    "complexName" TEXT,
    "country" TEXT,
    "region" TEXT,
    "streetName" TEXT,
    "postalCode" TEXT,
    "buildingNumber" TEXT,
    "additionalNumber" TEXT,
    "plotNumber" TEXT,
    "blockNumber" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "deedType" TEXT,
    "deedNumber" TEXT,
    "deedIssueDate" DATETIME,
    "deedFileUrl" TEXT,
    "description" TEXT,
    "shopsCount" INTEGER,
    "apartmentsCount" INTEGER,
    "elevatorsCount" INTEGER,
    "areaSqm" REAL,
    "constructionDate" DATETIME,
    "floorsCount" INTEGER,
    "unitsPerFloor" INTEGER,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "buildings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_buildings" ("additionalNumber", "address", "areaSqm", "blockNumber", "buildingNumber", "city", "complexName", "constructionDate", "country", "createdAt", "deedFileUrl", "deedIssueDate", "deedNumber", "deedType", "district", "floorsCount", "id", "name", "nameEn", "notes", "ownerId", "plotNumber", "postalCode", "propertyNumber", "propertyType", "region", "sector", "streetName", "unitsPerFloor", "updatedAt", "usageType") SELECT "additionalNumber", "address", "areaSqm", "blockNumber", "buildingNumber", "city", "complexName", "constructionDate", "country", "createdAt", "deedFileUrl", "deedIssueDate", "deedNumber", "deedType", "district", "floorsCount", "id", "name", "nameEn", "notes", "ownerId", "plotNumber", "postalCode", "propertyNumber", "propertyType", "region", "sector", "streetName", "unitsPerFloor", "updatedAt", "usageType" FROM "buildings";
DROP TABLE "buildings";
ALTER TABLE "new_buildings" RENAME TO "buildings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
