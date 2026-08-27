-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "ejarContractNumber" TEXT,
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
    "renewedFromId" TEXT,
    "createdById" TEXT,
    CONSTRAINT "contracts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contracts_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "contracts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_contracts" ("amountType", "contractNumber", "createdAt", "depositAmount", "ejarContractNumber", "endDate", "id", "increasePercent", "notes", "paymentFrequency", "renewedFromId", "rentAmount", "startDate", "status", "tenantId", "unitId", "updatedAt", "vatRate") SELECT "amountType", "contractNumber", "createdAt", "depositAmount", "ejarContractNumber", "endDate", "id", "increasePercent", "notes", "paymentFrequency", "renewedFromId", "rentAmount", "startDate", "status", "tenantId", "unitId", "updatedAt", "vatRate" FROM "contracts";
DROP TABLE "contracts";
ALTER TABLE "new_contracts" RENAME TO "contracts";
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");
CREATE UNIQUE INDEX "contracts_renewedFromId_key" ON "contracts"("renewedFromId");
CREATE TABLE "new_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "vendor" TEXT,
    "expenseDate" DATETIME NOT NULL,
    "paidDate" DATETIME,
    "bearer" TEXT NOT NULL DEFAULT 'OWNER',
    "fileUrl" TEXT,
    "notes" TEXT,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expenses_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expenses_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_expenses" ("amount", "bearer", "buildingId", "category", "createdAt", "description", "expenseDate", "fileUrl", "id", "notes", "paidDate", "unitId", "updatedAt", "vendor") SELECT "amount", "bearer", "buildingId", "category", "createdAt", "description", "expenseDate", "fileUrl", "id", "notes", "paidDate", "unitId", "updatedAt", "vendor" FROM "expenses";
DROP TABLE "expenses";
ALTER TABLE "new_expenses" RENAME TO "expenses";
CREATE TABLE "new_financial_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" REAL NOT NULL,
    "hasTax" BOOLEAN NOT NULL DEFAULT false,
    "taxNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "paymentId" TEXT,
    "contractId" TEXT,
    "expenseId" TEXT,
    "remittanceId" TEXT,
    CONSTRAINT "financial_documents_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "owner_remittances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_financial_documents" ("amount", "contractId", "createdAt", "documentNumber", "expenseId", "hasTax", "id", "issueDate", "notes", "paymentId", "remittanceId", "status", "taxNumber", "type") SELECT "amount", "contractId", "createdAt", "documentNumber", "expenseId", "hasTax", "id", "issueDate", "notes", "paymentId", "remittanceId", "status", "taxNumber", "type" FROM "financial_documents";
DROP TABLE "financial_documents";
ALTER TABLE "new_financial_documents" RENAME TO "financial_documents";
CREATE UNIQUE INDEX "financial_documents_documentNumber_key" ON "financial_documents"("documentNumber");
CREATE TABLE "new_owner_remittances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "remittedAt" DATETIME NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_remittances_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "owner_remittances_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "owner_remittances_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_owner_remittances" ("amount", "buildingId", "createdAt", "id", "method", "notes", "ownerId", "reference", "remittedAt") SELECT "amount", "buildingId", "createdAt", "id", "method", "notes", "ownerId", "reference", "remittedAt" FROM "owner_remittances";
DROP TABLE "owner_remittances";
ALTER TABLE "new_owner_remittances" RENAME TO "owner_remittances";
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "paidAmount" REAL,
    "paidDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "recipient" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "collectedById" TEXT,
    "contractId" TEXT NOT NULL,
    "najizReferredAt" DATETIME,
    CONSTRAINT "payments_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "contractId", "createdAt", "dueDate", "id", "method", "najizReferredAt", "notes", "paidAmount", "paidDate", "recipient", "reference", "status", "updatedAt") SELECT "amount", "contractId", "createdAt", "dueDate", "id", "method", "najizReferredAt", "notes", "paidAmount", "paidDate", "recipient", "reference", "status", "updatedAt" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

