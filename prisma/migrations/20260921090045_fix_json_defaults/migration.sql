-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyNewCardLimit" INTEGER NOT NULL DEFAULT 10,
    "learningStepsMinutes" JSONB,
    "relearningStepsMinutes" JSONB,
    "graduatingIntervalDays" REAL NOT NULL DEFAULT 1,
    "easyIntervalDays" REAL NOT NULL DEFAULT 4,
    "minimumIntervalDays" REAL NOT NULL DEFAULT 1,
    "easeFactorFloor" REAL NOT NULL DEFAULT 130,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("dailyNewCardLimit", "easeFactorFloor", "easyIntervalDays", "graduatingIntervalDays", "id", "learningStepsMinutes", "minimumIntervalDays", "relearningStepsMinutes", "userId") SELECT "dailyNewCardLimit", "easeFactorFloor", "easyIntervalDays", "graduatingIntervalDays", "id", "learningStepsMinutes", "minimumIntervalDays", "relearningStepsMinutes", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
