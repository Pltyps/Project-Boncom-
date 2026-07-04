import app from "../src/app";

// The single Vercel serverless function for this whole API. backend/vercel.json
// rewrites every incoming path here (not just /api) - req.url still carries
// the original path, so Express's own router handles matching internally.
// An Express app's call signature (req, res) => void already matches what
// @vercel/node expects from a function export, so no adapter is needed.
export default app;
