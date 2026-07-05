import { Pool, PoolClient } from "pg";
import { SessionUser } from "./auth";

type EntityType = "client" | "estimate";
type Action = "create" | "update" | "delete";

export async function recordAudit(
  db: Pool | PoolClient,
  entityType: EntityType,
  entityId: string,
  action: Action,
  actor: SessionUser
) {
  await db.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor_email, actor_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, action, actor.email, actor.name]
  );
}
