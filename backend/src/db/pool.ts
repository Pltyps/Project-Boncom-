import { Pool } from "pg";

// Single shared connection pool for the whole API process. Every route
// imports this instead of opening its own client.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  // Neon (and most hosted Postgres) requires SSL but presents a cert chain
  // that Node won't validate by default; local dev has no SSL at all.
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});
