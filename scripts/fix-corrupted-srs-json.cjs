// One-off repair for the SQLite Json @default() bug (see README "Known
// simplifications" / prisma/schema.prisma UserSettings comment): rows
// created before the `fix_json_defaults` migration have
// learningStepsMinutes/relearningStepsMinutes stored as invalid JSON
// (e.g. the bare text "1,10"), which crashes JSON.parse when Prisma reads
// them back. Safe to run any number of times.
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);

const rows = db.prepare("SELECT id, learningStepsMinutes, relearningStepsMinutes FROM UserSettings").all();
let fixed = 0;

for (const row of rows) {
  let needsFix = false;
  for (const col of ["learningStepsMinutes", "relearningStepsMinutes"]) {
    const value = row[col];
    if (value === null) continue;
    try {
      JSON.parse(value);
    } catch {
      needsFix = true;
    }
  }
  if (needsFix) {
    db.prepare(
      "UPDATE UserSettings SET learningStepsMinutes = NULL, relearningStepsMinutes = NULL WHERE id = ?"
    ).run(row.id);
    fixed++;
  }
}

console.log(`Checked ${rows.length} UserSettings row(s), fixed ${fixed}.`);
db.close();
