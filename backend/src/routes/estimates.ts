import { Router } from "express";
import { pool } from "../db/pool";
import { estimateSchema } from "../validation/schemas";
import { calculateTotals } from "../lib/totals";
import { recordAudit } from "../lib/auditLog";
import { insertLineItems, LineItemRow } from "../lib/lineItems";

export const estimatesRouter = Router();

interface EstimateRow {
  id: string;
  client_id: string;
  title: string;
  status: string;
  discount_type: "flat" | "percent";
  discount_value: string;
  tax_type: "flat" | "percent";
  tax_value: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
}

// Shapes a DB row + its line items into the camelCase JSON the frontend
// expects, recalculating totals from the authoritative decimal.js path
// every time rather than trusting a stored total column.
function serializeEstimate(estimate: EstimateRow, lineItems: LineItemRow[]) {
  const totals = calculateTotals({
    lineItems: lineItems.map((li) => ({ quantity: li.quantity, rate: li.rate })),
    discountType: estimate.discount_type,
    discountValue: estimate.discount_value,
    taxType: estimate.tax_type,
    taxValue: estimate.tax_value,
  });

  return {
    id: estimate.id,
    clientId: estimate.client_id,
    title: estimate.title,
    status: estimate.status,
    discountType: estimate.discount_type,
    discountValue: Number(estimate.discount_value),
    taxType: estimate.tax_type,
    taxValue: Number(estimate.tax_value),
    notes: estimate.notes,
    createdAt: estimate.created_at,
    updatedAt: estimate.updated_at,
    createdByName: estimate.created_by_name,
    updatedByName: estimate.updated_by_name,
    lineItems: lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      rate: Number(li.rate),
    })),
    totals,
  };
}

estimatesRouter.get("/", async (req, res, next) => {
  try {
    const { status, clientId, search } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status && typeof status === "string") {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }
    if (clientId && typeof clientId === "string") {
      params.push(clientId);
      conditions.push(`e.client_id = $${params.length}`);
    }
    if (search && typeof search === "string") {
      params.push(`%${search}%`);
      conditions.push(`(e.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT e.*, c.name AS client_name,
        COALESCE(SUM(li.quantity * li.rate), 0) AS subtotal
       FROM estimates e
       JOIN clients c ON c.id = e.client_id
       LEFT JOIN line_items li ON li.estimate_id = e.id
       ${where}
       GROUP BY e.id, c.name
       ORDER BY e.updated_at DESC`,
      params
    );

    res.json(
      result.rows.map((row) => {
        // SQL already summed quantity*rate into row.subtotal, so we hand
        // calculateTotals a single fake "line item" equal to that subtotal
        // instead of re-deriving it - same discount/tax math either way,
        // one source of truth for the formula.
        const totals = calculateTotals({
          lineItems: [{ quantity: 1, rate: row.subtotal }],
          discountType: row.discount_type,
          discountValue: row.discount_value,
          taxType: row.tax_type,
          taxValue: row.tax_value,
        });
        return {
          id: row.id,
          clientId: row.client_id,
          clientName: row.client_name,
          title: row.title,
          status: row.status,
          total: totals.total,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

estimatesRouter.get("/:id", async (req, res, next) => {
  try {
    const estimateResult = await pool.query<EstimateRow>(`SELECT * FROM estimates WHERE id = $1`, [
      req.params.id,
    ]);
    if (estimateResult.rows.length === 0) {
      return res.status(404).json({ error: "Estimate not found" });
    }
    const lineItemsResult = await pool.query<LineItemRow>(
      `SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY position ASC`,
      [req.params.id]
    );
    res.json(serializeEstimate(estimateResult.rows[0], lineItemsResult.rows));
  } catch (err) {
    next(err);
  }
});

// Recent history for one estimate - who created it, who's touched it since,
// and when. Purely additive (audit_log rows are never updated or deleted),
// so this is just a read of that append-only trail.
estimatesRouter.get("/:id/audit-log", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT action, actor_name, actor_email, created_at
       FROM audit_log WHERE entity_type = 'estimate' AND entity_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(
      result.rows.map((row) => ({
        action: row.action,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
        createdAt: row.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Estimate + its line items are created in one transaction so a failed
// line-item insert can't leave an estimate with no rows behind it.
estimatesRouter.post("/", async (req, res, next) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const actor = req.user!;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const estimateResult = await client.query<EstimateRow>(
      `INSERT INTO estimates
        (client_id, title, status, discount_type, discount_value, tax_type, tax_value, notes,
         created_by_email, created_by_name, updated_by_email, updated_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10)
       RETURNING *`,
      [
        data.clientId,
        data.title,
        data.status,
        data.discountType,
        data.discountValue,
        data.taxType,
        data.taxValue,
        data.notes ?? null,
        actor.email,
        actor.name,
      ]
    );
    const estimate = estimateResult.rows[0];
    const lineItems = await insertLineItems(client, estimate.id, data.lineItems);

    await recordAudit(client, "estimate", estimate.id, "create", actor);
    await client.query("COMMIT");
    res.status(201).json(serializeEstimate(estimate, lineItems));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

estimatesRouter.put("/:id", async (req, res, next) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const actor = req.user!;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const estimateResult = await client.query<EstimateRow>(
      `UPDATE estimates SET
        client_id = $1, title = $2, status = $3,
        discount_type = $4, discount_value = $5,
        tax_type = $6, tax_value = $7, notes = $8, updated_at = now(),
        updated_by_email = $9, updated_by_name = $10
       WHERE id = $11
       RETURNING *`,
      [
        data.clientId,
        data.title,
        data.status,
        data.discountType,
        data.discountValue,
        data.taxType,
        data.taxValue,
        data.notes ?? null,
        actor.email,
        actor.name,
        req.params.id,
      ]
    );

    if (estimateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Estimate not found" });
    }
    const estimate = estimateResult.rows[0];

    // Full replace of line items on every update keeps the editor's
    // "array of rows" model in sync with the DB without diffing.
    await client.query(`DELETE FROM line_items WHERE estimate_id = $1`, [estimate.id]);
    const lineItems = await insertLineItems(client, estimate.id, data.lineItems);

    await recordAudit(client, "estimate", estimate.id, "update", actor);
    await client.query("COMMIT");
    res.json(serializeEstimate(estimate, lineItems));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

estimatesRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM estimates WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estimate not found" });
    }
    await recordAudit(pool, "estimate", req.params.id, "delete", req.user!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Copies an estimate and all its line items into a brand new row, always
// reset to draft status - duplicating a "sent" estimate shouldn't silently
// mark the copy as already sent to the client. Attribution on the copy is
// the person who duplicated it, not carried over from the source.
estimatesRouter.post("/:id/duplicate", async (req, res, next) => {
  const actor = req.user!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const estimateResult = await client.query<EstimateRow>(`SELECT * FROM estimates WHERE id = $1`, [
      req.params.id,
    ]);
    if (estimateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Estimate not found" });
    }
    const source = estimateResult.rows[0];

    const sourceLineItems = await client.query<LineItemRow>(
      `SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY position ASC`,
      [source.id]
    );

    const newEstimateResult = await client.query<EstimateRow>(
      `INSERT INTO estimates
        (client_id, title, status, discount_type, discount_value, tax_type, tax_value, notes,
         created_by_email, created_by_name, updated_by_email, updated_by_name)
       VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9, $8, $9)
       RETURNING *`,
      [
        source.client_id,
        `${source.title} (copy)`,
        source.discount_type,
        source.discount_value,
        source.tax_type,
        source.tax_value,
        source.notes,
        actor.email,
        actor.name,
      ]
    );
    const newEstimate = newEstimateResult.rows[0];
    const newLineItems = await insertLineItems(
      client,
      newEstimate.id,
      sourceLineItems.rows.map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        rate: Number(li.rate),
      }))
    );

    await recordAudit(client, "estimate", newEstimate.id, "create", actor);
    await client.query("COMMIT");
    res.status(201).json(serializeEstimate(newEstimate, newLineItems));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});
