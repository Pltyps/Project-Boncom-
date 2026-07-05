import { NextFunction, Request, Response } from "express";
import { Role, roleMeets } from "../lib/auth";

// Must run after requireAuth, which attaches req.user.
export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roleMeets(req.user.role, minRole)) {
      return res.status(403).json({ error: "You don't have access to this." });
    }
    next();
  };
}
