-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "nationalId" TEXT,
    "phone" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "staffRoleId" TEXT,
    CONSTRAINT "users_staffRoleId_fkey" FOREIGN KEY ("staffRoleId") REFERENCES "staff_roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "email", "id", "isActive", "name", "nationalId", "passwordHash", "phone", "role", "staffRoleId", "updatedAt") SELECT "createdAt", "email", "id", "isActive", "name", "nationalId", "passwordHash", "phone", "role", "staffRoleId", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_nationalId_key" ON "users"("nationalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

