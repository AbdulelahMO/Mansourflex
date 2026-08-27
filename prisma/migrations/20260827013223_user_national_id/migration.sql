-- AlterTable
ALTER TABLE "users" ADD COLUMN "nationalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_nationalId_key" ON "users"("nationalId");

