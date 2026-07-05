import { Router } from "express";
import { pool } from "../db/pool";
import { clientSchema } from "../validation/schemas";
import { recordAudit } from "../lib/auditLog";

// Plain CRUD for the client list. Clients can't be deleted while an
// estimate still references them - the FK on estimates.client_id is
// ON DELETE RESTRICT, so that DELETE below relies on Postgres to reject it
// (caught centrally in app.ts's error handler as a 409).
export const clientsRouter = Router();

clientsRouter.get("/", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, company, address, created_at, updated_at,
        created_by_name, updated_by_name
       FROM clients ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

clientsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM clients WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

clientsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, email, company, address } = parsed.data;
    const actor = req.user!;
    const result = await pool.query(
      `INSERT INTO clients (name, email, company, address, created_by_email, created_by_name, updated_by_email, updated_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $5, $6) RETURNING *`,
      [name, email ?? null, company ?? null, address ?? null, actor.email, actor.name]
    );
    await recordAudit(pool, "client", result.rows[0].id, "create", actor);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

clientsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, email, company, address } = parsed.data;
    const actor = req.user!;
    const result = await pool.query(
      `UPDATE clients SET name = $1, email = $2, company = $3, address = $4, updated_at = now(),
        updated_by_email = $5, updated_by_name = $6
       WHERE id = $7 RETURNING *`,
      [name, email ?? null, company ?? null, address ?? null, actor.email, actor.name, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    await recordAudit(pool, "client", req.params.id, "update", actor);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

clientsRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM clients WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    await recordAudit(pool, "client", req.params.id, "delete", req.user!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
