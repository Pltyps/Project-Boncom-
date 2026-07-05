import { Pool } from "pg";
import { GoogleIdentity, Role, SessionUser } from "./auth";

// Creates a user row on first sign-in, or updates name/last_login_at on
// every sign-in after that. Role is intentionally untouched once set - see
// schema.sql for why - except for the very first user ever, who becomes
// admin automatically so there's always someone able to grant access to
// everyone else without a manual DB edit.
export async function upsertUser(pool: Pool, identity: GoogleIdentity): Promise<SessionUser> {
  const { rows: countRows } = await pool.query<{ count: string }>(`SELECT count(*) FROM users`);
  const isFirstUserEver = countRows[0].count === "0";

  const result = await pool.query<{ role: Role }>(
    `INSERT INTO users (email, name, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = $2, last_login_at = now()
     RETURNING role`,
    [identity.email, identity.name, isFirstUserEver ? "admin" : "user"]
  );

  return { ...identity, role: result.rows[0].role };
}
