-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_building_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "buildingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "building_photos_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_building_photos" ("buildingId", "caption", "createdAt", "id", "url") SELECT "buildingId", "caption", "createdAt", "id", "url" FROM "building_photos";
DROP TABLE "building_photos";
ALTER TABLE "new_building_photos" RENAME TO "building_photos";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

