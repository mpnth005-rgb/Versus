/*
  Warnings:

  - You are about to alter the column `adjustedScore` on the `Correction` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `overallScore` on the `Correction` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Correction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL,
    "adjustedScore" REAL NOT NULL,
    "referenceTranslation" TEXT NOT NULL,
    "sentenceCorrections" JSONB NOT NULL,
    "suggestedCards" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Correction_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Correction" ("adjustedScore", "createdAt", "exerciseId", "id", "overallScore", "referenceTranslation", "sentenceCorrections", "suggestedCards") SELECT "adjustedScore", "createdAt", "exerciseId", "id", "overallScore", "referenceTranslation", "sentenceCorrections", "suggestedCards" FROM "Correction";
DROP TABLE "Correction";
ALTER TABLE "new_Correction" RENAME TO "Correction";
CREATE UNIQUE INDEX "Correction_exerciseId_key" ON "Correction"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
