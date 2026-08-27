-- CreateTable
CREATE TABLE "agreement_settlements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settledAt" DATETIME NOT NULL,
    "periodFrom" DATETIME NOT NULL,
    "periodTo" DATETIME NOT NULL,
    "collected" REAL NOT NULL,
    "ownerExpenses" REAL NOT NULL,
    "netCollected" REAL NOT NULL,
    "commissionPercent" REAL NOT NULL,
    "commission" REAL NOT NULL,
    "operatorExpenses" REAL NOT NULL,
    "netCommission" REAL NOT NULL,
    "payableToOwner" REAL NOT NULL,
    "pendingArrears" REAL NOT NULL DEFAULT 0,
    "pendingExpenses" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "agreementId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agreement_settlements_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "management_agreements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "agreement_settlements_agreementId_key" ON "agreement_settlements"("agreementId");
