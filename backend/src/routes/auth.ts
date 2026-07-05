import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken, signSession, isEmailAllowed, isDemoAccount, Role } from "../lib/auth";
import { upsertUser } from "../lib/users";
import { recordAudit } from "../lib/auditLog";
import { requireAuth } from "../middleware/requireAuth";
import { pool } from "../db/pool";

export const authRouter = Router();

const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

authRouter.post("/google", async (req, res, next) => {
  const parsed = googleLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing idToken" });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(parsed.data.idToken);
  } catch {
    return res.status(401).json({ error: "Could not verify Google sign-in" });
  }

  if (!isEmailAllowed(identity.email)) {
    return res.status(403).json({ error: "This account is not authorized to use this app" });
  }

  try {
    const user = await upsertUser(pool, identity);
    const token = signSession(user);
    res.json({ token, user: { ...user, demo: isDemoAccount(user.email) } });
  } catch (err) {
    next(err);
  }
});

const roleSwitchSchema = z.object({
  role: z.enum(["user", "dev", "admin"]),
});

// Self-service role switch, restricted to demo accounts (see isDemoAccount).
// Lets the reviewer walk the app as user/dev/admin without a second admin to
// restore access afterwards - the normal admin endpoint deliberately refuses
// self-changes, so without this a demoted demo admin would be locked out.
// Issues a fresh session token since the role lives inside the JWT.
authRouter.post("/role", requireAuth, async (req, res, next) => {
  const actor = req.user!;
  if (!isDemoAccount(actor.email)) {
    return res.status(403).json({ error: "Only the demo account can switch its own role" });
  }
  const parsed = roleSwitchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const role = parsed.data.role as Role;

  try {
    const result = await pool.query<{ id: string; email: string; name: string; role: Role }>(
      `UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, name, role`,
      [role, actor.email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const updated = result.rows[0];
    if (actor.role !== updated.role) {
      await recordAudit(pool, "user", updated.id, "update", actor, [
        { field: "Role (demo switch)", oldValue: actor.role, newValue: updated.role },
      ]);
    }
    const user = { email: updated.email, name: updated.name, role: updated.role };
    res.json({ token: signSession(user), user: { ...user, demo: true } });
  } catch (err) {
    next(err);
  }
});
