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
  // On Vercel this module gets re-imported per cold start, and each warm
  // serverless instance only ever handles one request at a time - a large
  // pool here just opens connections that sit idle. Neon's pooled endpoint
  // (PgBouncer) is what actually absorbs concurrency across instances.
  max: process.env.VERCEL ? 1 : 10,
});
