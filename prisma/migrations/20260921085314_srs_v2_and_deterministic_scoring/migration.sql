/*
  Warnings:

  - You are about to drop the column `intervalMinutes` on the `Flashcard` table. All the data in the column will be lost.
  - You are about to drop the column `repetitions` on the `Flashcard` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "dueAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" REAL NOT NULL DEFAULT 0,
    "easeFactor" REAL NOT NULL DEFAULT 250,
    "sourceExerciseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Flashcard_sourceExerciseId_fkey" FOREIGN KEY ("sourceExerciseId") REFERENCES "Exercise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Flashcard" ("back", "createdAt", "dueAt", "easeFactor", "front", "id", "sourceExerciseId", "state", "userId") SELECT "back", "createdAt", "dueAt", "easeFactor", "front", "id", "sourceExerciseId", "state", "userId" FROM "Flashcard";
DROP TABLE "Flashcard";
ALTER TABLE "new_Flashcard" RENAME TO "Flashcard";
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyNewCardLimit" INTEGER NOT NULL DEFAULT 10,
    "learningStepsMinutes" JSONB NOT NULL DEFAULT [1,10],
    "relearningStepsMinutes" JSONB NOT NULL DEFAULT [10],
    "graduatingIntervalDays" REAL NOT NULL DEFAULT 1,
    "easyIntervalDays" REAL NOT NULL DEFAULT 4,
    "minimumIntervalDays" REAL NOT NULL DEFAULT 1,
    "easeFactorFloor" REAL NOT NULL DEFAULT 130,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("dailyNewCardLimit", "id", "userId") SELECT "dailyNewCardLimit", "id", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
