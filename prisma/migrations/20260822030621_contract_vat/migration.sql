-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "rentAmount" REAL NOT NULL,
    "amountType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "increasePercent" REAL,
    "vatRate" REAL NOT NULL DEFAULT 0,
    "depositAmount" REAL,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "contracts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_contracts" ("amountType", "contractNumber", "createdAt", "depositAmount", "endDate", "id", "increasePercent", "notes", "paymentFrequency", "rentAmount", "startDate", "status", "tenantId", "unitId", "updatedAt") SELECT "amountType", "contractNumber", "createdAt", "depositAmount", "endDate", "id", "increasePercent", "notes", "paymentFrequency", "rentAmount", "startDate", "status", "tenantId", "unitId", "updatedAt" FROM "contracts";
DROP TABLE "contracts";
ALTER TABLE "new_contracts" RENAME TO "contracts";
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
