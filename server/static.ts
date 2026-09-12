import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // Determine the correct path for the public folder
  // In production, files are in dist/public relative to dist/index.cjs
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  
  // Try multiple possible paths
  let distPath = path.resolve(dirname, "public");
  
  // In production bundle, __dirname might point to a different location
  // Try the sibling public folder
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(dirname, "..", "public");
  }
  
  // Final fallback
  if (!fs.existsSync(distPath)) {
    distPath = path.join(process.cwd(), "public");
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first. Checked: [${path.resolve(dirname, "public")}, ${path.resolve(dirname, "..", "public")}, ${path.join(process.cwd(), "public")}]`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

