import { Pool, PoolClient } from "pg";
import { SessionUser } from "./auth";

type EntityType = "client" | "estimate";
type Action = "create" | "update" | "delete";

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export async function recordAudit(
  db: Pool | PoolClient,
  entityType: EntityType,
  entityId: string,
  action: Action,
  actor: SessionUser,
  changes?: FieldChange[]
) {
  await db.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor_email, actor_name, changes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, action, actor.email, actor.name, changes && changes.length ? JSON.stringify(changes) : null]
  );
}

// Compares a fixed list of {field, label} pairs between an old and new
// record and returns only the ones whose (stringified) value actually
// changed - used to populate the History panel's before/after list on updates.
export function diffFields<T extends Record<string, unknown>>(
  oldRecord: T,
  newRecord: T,
  fields: { key: keyof T; label: string }[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { key, label } of fields) {
    const oldValue = oldRecord[key];
    const newValue = newRecord[key];
    const oldStr = oldValue === null || oldValue === undefined || oldValue === "" ? null : String(oldValue);
    const newStr = newValue === null || newValue === undefined || newValue === "" ? null : String(newValue);
    if (oldStr !== newStr) {
      changes.push({ field: label, oldValue: oldStr, newValue: newStr });
    }
  }
  return changes;
}
