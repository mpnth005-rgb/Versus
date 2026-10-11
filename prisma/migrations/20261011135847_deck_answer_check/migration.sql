-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "category" TEXT;

-- CreateTable
CREATE TABLE "DeckCheckUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studyDay" TEXT NOT NULL,
    "checksUsed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DeckCheckUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeckCheckUsage_userId_studyDay_key" ON "DeckCheckUsage"("userId", "studyDay");
