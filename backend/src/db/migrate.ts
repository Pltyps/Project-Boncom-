import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./pool";

// Runs the whole schema.sql file against DATABASE_URL. Every statement in
// schema.sql uses CREATE TABLE/INDEX IF NOT EXISTS, so this is safe to
// re-run on every deploy without a separate migration-tracking table.
async function migrate() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Migration complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
