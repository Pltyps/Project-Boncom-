import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { clientsRouter } from "./routes/clients";
import { estimatesRouter } from "./routes/estimates";

// Just builds and exports the Express app - no .listen() here. That lives
// in server.ts (local dev) so this same app can also be wrapped as a single
// Vercel serverless function (api/[...all].ts) without pulling in a port bind.
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/clients", clientsRouter);
app.use("/api/estimates", estimatesRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

interface DbError extends Error {
  code?: string;
}

// Centralized so routes can just throw/reject and let Postgres error codes
// map to the right HTTP status, instead of every route re-checking these.
app.use((err: DbError, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err.code === "23503") {
    // foreign_key_violation, e.g. deleting a client that still has estimates
    return res.status(409).json({ error: "This record is referenced by other data and cannot be modified." });
  }
  if (err.code === "23505") {
    // unique_violation
    return res.status(409).json({ error: "A record with this value already exists." });
  }
  if (err.code === "22P02") {
    // invalid_text_representation, e.g. a malformed UUID in a :id param
    return res.status(400).json({ error: "Invalid id." });
  }

  res.status(500).json({ error: "Internal server error" });
});

export default app;
