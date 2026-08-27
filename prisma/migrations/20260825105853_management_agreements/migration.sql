-- CreateTable
CREATE TABLE "management_agreements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementNumber" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
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

-- CreateTable
CREATE TABLE "agreement_buildings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commissionPercent" REAL NOT NULL DEFAULT 0,
    "commissionBasis" TEXT NOT NULL DEFAULT 'COLLECTED',
    "agreementId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "agreement_buildings_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "management_agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agreement_buildings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "management_agreements_agreementNumber_key" ON "management_agreements"("agreementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_buildings_agreementId_buildingId_key" ON "agreement_buildings"("agreementId", "buildingId");
