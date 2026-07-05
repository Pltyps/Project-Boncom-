import { PoolClient } from "pg";

export interface LineItemInput {
  description: string;
  quantity: number;
  rate: number;
}

export interface LineItemRow {
  id: string;
  estimate_id: string;
  description: string;
  quantity: string;
  rate: string;
  position: number;
}

// Single multi-row INSERT instead of one round-trip per line item. Under
// concurrent load this matters more than it looks: each request holds its
// one pooled connection (see db/pool.ts) for the whole transaction, so an
// estimate with 50 line items previously meant 50 sequential round-trips
// before the connection could serve anyone else.
export async function insertLineItems(
  client: PoolClient,
  estimateId: string,
  items: LineItemInput[]
): Promise<LineItemRow[]> {
  if (items.length === 0) return [];

  const values: string[] = [];
  const params: unknown[] = [];
  items.forEach((li, i) => {
    const base = i * 5;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    params.push(estimateId, li.description, li.quantity, li.rate, i);
  });

  const result = await client.query<LineItemRow>(
    `INSERT INTO line_items (estimate_id, description, quantity, rate, position)
     VALUES ${values.join(", ")}
     RETURNING *`,
    params
  );

  // Postgres doesn't guarantee RETURNING preserves VALUES order, so sort
  // explicitly rather than assume it - the position column is exactly for this.
  return result.rows.sort((a, b) => a.position - b.position);
}
