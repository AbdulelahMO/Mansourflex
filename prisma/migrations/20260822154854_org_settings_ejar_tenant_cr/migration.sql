-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "ejarContractNumber" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "commercialRegister" TEXT;

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT,
    "commercialRegister" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
