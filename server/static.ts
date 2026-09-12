import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Get the directory where index.cjs is located (/app/dist)
  const distPath = path.join(__dirname, "public");
  
  console.log(`[serveStatic] Looking for public files at: ${distPath}`);
  console.log(`[serveStatic] __dirname is: ${__dirname}`);
  console.log(`[serveStatic] Folder exists: ${fs.existsSync(distPath)}`);

  if (!fs.existsSync(distPath)) {
    const alternatives = [
      path.join(__dirname, "public"),
      path.join(__dirname, "..", "public"),
      path.join(process.cwd(), "public"),
      "/app/dist/public",
    ];
    throw new Error(
      `[serveStatic ERROR] Could not find public folder. Checked: ${alternatives.join(" | ")}`,
    );
  }

  try {
    // List contents to verify
    const files = fs.readdirSync(distPath);
    console.log(`[serveStatic] Public folder contains: ${files.join(", ")}`);
  } catch (e) {
    console.error(`[serveStatic] Error reading public folder:`, e);
  }

  // Serve static files from public directory
  app.use(express.static(distPath));

  // Serve index.html for all other routes (SPA routing)
  app.get("*", (_req, res) => {
    const indexPath = path.join(distPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[serveStatic] Error sending index.html:`, err);
        res.status(500).json({ error: "Could not serve index.html" });
      }
    });
  });
}
