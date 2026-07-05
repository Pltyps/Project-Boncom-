import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";

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
  try {
    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role`,
      [parsed.data.role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
