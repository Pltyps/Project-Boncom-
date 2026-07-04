import { Router } from "express";
import { pool } from "../db/pool";
import { clientSchema } from "../validation/schemas";

// Plain CRUD for the client list. Clients can't be deleted while an
// estimate still references them - the FK on estimates.client_id is
// ON DELETE RESTRICT, so that DELETE below relies on Postgres to reject it
// (caught centrally in index.ts's error handler as a 409).
export const clientsRouter = Router();

clientsRouter.get("/", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, company, created_at, updated_at
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
    const { name, email, company } = parsed.data;
    const result = await pool.query(
      `INSERT INTO clients (name, email, company) VALUES ($1, $2, $3) RETURNING *`,
      [name, email ?? null, company ?? null]
    );
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
    const { name, email, company } = parsed.data;
    const result = await pool.query(
      `UPDATE clients SET name = $1, email = $2, company = $3, updated_at = now()
       WHERE id = $4 RETURNING *`,
      [name, email ?? null, company ?? null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
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
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
