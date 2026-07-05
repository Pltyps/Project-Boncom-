import { Router } from "express";
import { pool } from "../db/pool";
import { roleMeets, Role } from "../lib/auth";

export const appsRouter = Router();

interface AppRow {
  slug: string;
  name: string;
  description: string;
  status: "active" | "coming_soon";
  min_role: Role;
  sort_order: number;
}

// The toolshed home screen's tile list. `accessible` folds together both
// gates (built yet? role high enough?) into one flag so the frontend can
// just render greyed-out vs. clickable without re-deriving the rule itself.
appsRouter.get("/", async (req, res, next) => {
  try {
    const result = await pool.query<AppRow>(`SELECT * FROM apps ORDER BY sort_order ASC`);
    const role = req.user!.role;
    res.json(
      result.rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        status: row.status,
        accessible: row.status === "active" && roleMeets(role, row.min_role),
      }))
    );
  } catch (err) {
    next(err);
  }
});
