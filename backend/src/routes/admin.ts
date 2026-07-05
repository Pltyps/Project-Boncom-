import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { recordAudit } from "../lib/auditLog";

export const adminRouter = Router();

// Mounted behind requireAuth + requireRole("admin") in app.ts - every route
// here assumes the caller is already confirmed admin.

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at, last_login_at FROM users ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

const roleSchema = z.object({
  role: z.enum(["user", "dev", "admin"]),
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const actor = req.user!;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const beforeResult = await client.query<{ id: string; email: string; role: string }>(
      `SELECT id, email, role FROM users WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (beforeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }
    const before = beforeResult.rows[0];

    // Two lockout guards. Self-changes are refused so an admin can't demote
    // themselves by accident and lose access to this very page (the demo
    // account has its own audited switch at POST /api/auth/role). And the
    // last admin can never be demoted - someone must always be able to
    // manage roles without a manual DB edit.
    if (before.email.toLowerCase() === actor.email.toLowerCase()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You can't change your own role" });
    }
    if (before.role === "admin" && parsed.data.role !== "admin") {
      const adminCount = await client.query<{ count: string }>(
        `SELECT count(*) FROM users WHERE role = 'admin'`
      );
      if (Number(adminCount.rows[0].count) <= 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cannot demote the last admin" });
      }
    }

    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role`,
      [parsed.data.role, req.params.id]
    );
    if (before.role !== parsed.data.role) {
      await recordAudit(client, "user", before.id, "update", actor, [
        { field: "Role", oldValue: before.role, newValue: parsed.data.role },
      ]);
    }
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});
