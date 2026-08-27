-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agreement_buildings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionPercent" REAL NOT NULL DEFAULT 0,
    "agreementId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "agreement_buildings_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "management_agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agreement_buildings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agreement_buildings" ("agreementId", "buildingId", "commissionPercent", "id") SELECT "agreementId", "buildingId", "commissionPercent", "id" FROM "agreement_buildings";
DROP TABLE "agreement_buildings";
ALTER TABLE "new_agreement_buildings" RENAME TO "agreement_buildings";
CREATE UNIQUE INDEX "agreement_buildings_agreementId_buildingId_key" ON "agreement_buildings"("agreementId", "buildingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

