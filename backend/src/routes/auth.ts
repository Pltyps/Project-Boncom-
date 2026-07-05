import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken, signSession, isEmailAllowed } from "../lib/auth";
import { upsertUser } from "../lib/users";
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
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});
