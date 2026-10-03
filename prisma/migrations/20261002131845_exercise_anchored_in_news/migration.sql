-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "textType" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "subtheme" JSONB,
    "anchoredInNews" BOOLEAN NOT NULL DEFAULT false,
    "sourceText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("createdAt", "id", "level", "sourceText", "status", "subtheme", "textType", "themes", "title", "userId", "wordCount") SELECT "createdAt", "id", "level", "sourceText", "status", "subtheme", "textType", "themes", "title", "userId", "wordCount" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
