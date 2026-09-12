import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Multiple possible paths where dist/public could be located
  // In production, __dirname will point to where index.cjs is located
  let distPath: string | null = null;

  // Try 1: Same directory as index.cjs (dist/)
  let tryPath = path.join(__dirname, "public");
  if (fs.existsSync(tryPath)) {
    distPath = tryPath;
  }

  // Try 2: Parent directory + public (if bundled differently)
  if (!distPath) {
    tryPath = path.join(__dirname, "..", "public");
    if (fs.existsSync(tryPath)) {
      distPath = tryPath;
    }
  }

  // Try 3: Current working directory + public
  if (!distPath) {
    tryPath = path.join(process.cwd(), "public");
    if (fs.existsSync(tryPath)) {
      distPath = tryPath;
    }
  }

  // Try 4: absolute path from dist/public (production Railway)
  if (!distPath) {
    tryPath = "/app/dist/public";
    if (fs.existsSync(tryPath)) {
      distPath = tryPath;
    }
  }

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Checked: [${path.join(__dirname, "public")}, ${path.join(__dirname, "..", "public")}, ${path.join(process.cwd(), "public")}, /app/dist/public]. Make sure to build the client first with 'npm run build'.`,
    );
  }

  console.log(`[serveStatic] Serving static files from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    const indexPath = path.join(distPath!, "index.html");
    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({ error: "index.html not found" });
    }
    res.sendFile(indexPath);
  });
}

