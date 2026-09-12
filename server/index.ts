import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

console.log("[STARTUP] Booting Card-Inspector-Proz server...");
console.log(`[STARTUP] NODE_ENV=${process.env.NODE_ENV || "undefined"}`);
console.log(`[STARTUP] PORT env=${process.env.PORT || "not set (defaulting to 5000)"}`);

process.on("unhandledRejection", (reason) => {
  console.error("[STARTUP] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[STARTUP] Uncaught exception:", err);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Registering routes...");
    await registerRoutes(httpServer, app);
    log("Routes registered successfully.");

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      log("Serving static build (production mode)...");
      serveStatic(app);
    } else {
      log("Setting up Vite dev middleware (development mode)...");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    log(`Attempting to listen on port ${port}...`);

    httpServer.on("error", (err: any) => {
      console.error(`[STARTUP] Failed to start server on port ${port}:`, err);
      process.exit(1);
    });

    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${port}`);
        console.log(`[STARTUP] Server is up and listening on 0.0.0.0:${port}`);
      },
    );
  } catch (err) {
    console.error("[STARTUP] Fatal error during server initialization:", err);
    process.exit(1);
  }
})();
