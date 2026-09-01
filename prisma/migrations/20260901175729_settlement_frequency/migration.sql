-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_management_agreements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementNumber" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "signedAt" DATETIME,
    "signedPlace" TEXT,
    "settlementFrequency" TEXT NOT NULL DEFAULT 'PER_COLLECTION',
    "terms" TEXT,
    "duties" TEXT,
    "notes" TEXT,
    "canSignContracts" BOOLEAN NOT NULL DEFAULT false,
    "canCollectRent" BOOLEAN NOT NULL DEFAULT false,
    "canMaintain" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceLimit" REAL,
    "canLitigate" BOOLEAN NOT NULL DEFAULT false,
    "canNegotiateRenewal" BOOLEAN NOT NULL DEFAULT false,
    "otherAuthorities" TEXT,
    "fileUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "management_agreements_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_management_agreements" ("agreementNumber", "canCollectRent", "canLitigate", "canMaintain", "canNegotiateRenewal", "canSignContracts", "createdAt", "duties", "endDate", "fileUrl", "id", "maintenanceLimit", "notes", "otherAuthorities", "ownerId", "signedAt", "signedPlace", "startDate", "status", "terms", "updatedAt") SELECT "agreementNumber", "canCollectRent", "canLitigate", "canMaintain", "canNegotiateRenewal", "canSignContracts", "createdAt", "duties", "endDate", "fileUrl", "id", "maintenanceLimit", "notes", "otherAuthorities", "ownerId", "signedAt", "signedPlace", "startDate", "status", "terms", "updatedAt" FROM "management_agreements";
DROP TABLE "management_agreements";
ALTER TABLE "new_management_agreements" RENAME TO "management_agreements";
CREATE UNIQUE INDEX "management_agreements_agreementNumber_key" ON "management_agreements"("agreementNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

