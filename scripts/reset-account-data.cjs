/* eslint-disable @typescript-eslint/no-require-imports */
// Wipes a single user's activity data (exercises, translations,
// corrections, flashcards, monthly quota usage) while keeping the
// account itself (login, subscription, settings) intact.
//
// Usage: node scripts/reset-account-data.cjs you@example.com
const path = require("node:path");
const Database = require("better-sqlite3");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/reset-account-data.cjs <email>");
  process.exit(1);
}

const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const user = db.prepare("SELECT id, email FROM User WHERE email = ?").get(email);
if (!user) {
  console.error(`No user found with email ${email}.`);
  process.exit(1);
}

const reset = db.transaction((userId) => {
  // Translation/Correction cascade-delete with their Exercise (see
  // prisma/schema.prisma onDelete: Cascade), so deleting Exercise rows
  // is enough for those two tables.
  const exercises = db.prepare("DELETE FROM Exercise WHERE userId = ?").run(userId);
  const flashcards = db.prepare("DELETE FROM Flashcard WHERE userId = ?").run(userId);
  const usage = db.prepare("DELETE FROM MonthlyUsage WHERE userId = ?").run(userId);
  return { exercises: exercises.changes, flashcards: flashcards.changes, usage: usage.changes };
});

const result = reset(user.id);
console.log(`Reset data for ${user.email}:`);
console.log(`  Exercises deleted: ${result.exercises} (translations/corrections cascade with them)`);
console.log(`  Flashcards deleted: ${result.flashcards}`);
console.log(`  Monthly usage rows deleted: ${result.usage}`);
console.log("Account, login, subscription and settings were left untouched.");

db.close();
