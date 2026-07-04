import app from "../src/app";

// Vercel's catch-all convention: this one file handles every request under
// /api/*. An Express app's call signature (req, res) => void already
// matches what @vercel/node expects from a function export, so no adapter
// is needed - just hand Vercel the app itself.
export default app;
