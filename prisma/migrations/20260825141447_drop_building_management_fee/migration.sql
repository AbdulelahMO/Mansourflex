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
INSERT INTO "new_buildings" ("additionalNumber", "address", "apartmentsCount", "areaSqm", "blockNumber", "buildingNumber", "city", "complexName", "constructionDate", "country", "createdAt", "deedFileUrl", "deedIssueDate", "deedNumber", "deedType", "description", "district", "elevatorsCount", "floorsCount", "id", "latitude", "longitude", "name", "nameEn", "notes", "ownerId", "plotNumber", "postalCode", "propertyNumber", "propertyType", "region", "sector", "shopsCount", "streetName", "unitsPerFloor", "updatedAt", "usageType") SELECT "additionalNumber", "address", "apartmentsCount", "areaSqm", "blockNumber", "buildingNumber", "city", "complexName", "constructionDate", "country", "createdAt", "deedFileUrl", "deedIssueDate", "deedNumber", "deedType", "description", "district", "elevatorsCount", "floorsCount", "id", "latitude", "longitude", "name", "nameEn", "notes", "ownerId", "plotNumber", "postalCode", "propertyNumber", "propertyType", "region", "sector", "shopsCount", "streetName", "unitsPerFloor", "updatedAt", "usageType" FROM "buildings";
DROP TABLE "buildings";
ALTER TABLE "new_buildings" RENAME TO "buildings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

