import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduler";
import { cronRoutes } from "../cronRoutes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Cron jobs endpoints under /api/cron
  app.use("/api/cron", cronRoutes);
  
  // Route de test pour vérifier les heures hors forfait d'Enka Enka
  app.get("/api/test-out-of-package", async (req, res) => {
    const { getOutOfPackageHoursByResidentId, getDb } = await import('../db');
    const { packages, attendances } = await import('../../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    
    const db = await getDb();
    if (!db) {
      return res.json({ error: 'Database not available' });
    }
    
    const allPackages = await db.select().from(packages).where(eq(packages.residentId, 1));
    const allAttendances = await db.select().from(attendances).where(eq(attendances.residentId, 1));
    const outOfPackageMinutes = await getOutOfPackageHoursByResidentId(1);
    
    res.json({ 
      residentId: 1, 
      outOfPackageMinutes,
      packages: allPackages,
      attendances: allAttendances
    });
  });

  

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Démarrer le scheduler pour les e-mails automatiques
    startScheduler();
  });
}

startServer().catch(console.error);
