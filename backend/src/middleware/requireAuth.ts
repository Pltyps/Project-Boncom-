import { NextFunction, Request, Response } from "express";
import { verifySession, SessionUser } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Sign-in required" });
  }
  try {
    req.user = verifySession(token);
    next();
  } catch {
    res.status(401).json({ error: "Session expired or invalid, please sign in again" });
  }
}
