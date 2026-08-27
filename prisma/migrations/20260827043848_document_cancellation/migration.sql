-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "paymentId" TEXT,
    "contractId" TEXT,
    "expenseId" TEXT,
    "remittanceId" TEXT,
    CONSTRAINT "financial_documents_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "financial_documents_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "owner_remittances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_financial_documents" ("amount", "contractId", "createdAt", "documentNumber", "expenseId", "hasTax", "id", "issueDate", "issuedById", "notes", "paymentId", "remittanceId", "status", "taxNumber", "type") SELECT "amount", "contractId", "createdAt", "documentNumber", "expenseId", "hasTax", "id", "issueDate", "issuedById", "notes", "paymentId", "remittanceId", "status", "taxNumber", "type" FROM "financial_documents";
DROP TABLE "financial_documents";
ALTER TABLE "new_financial_documents" RENAME TO "financial_documents";
CREATE UNIQUE INDEX "financial_documents_documentNumber_key" ON "financial_documents"("documentNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

