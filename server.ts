import express from "express";
import path from "path";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./server/routes/api";
import License from "./server/models/License";
import { startAutoLocalPull } from "./server/services/localSyncService";

console.log("SERVER.TS STARTING...");
dotenv.config();

async function startServer() {
  try {
    console.log("Initializing HaniLink Server...");
    const app = express();
    const PORT = Number(process.env.PORT || 3000);

    // MongoDB Connection
    const MONGODB_URI = process.env.MONGODB_URI;
    try {
      if (!MONGODB_URI) {
        if (process.env.DESKTOP_EMBEDDED === "1" || process.env.SKIP_MONGO_MEMORY === "1") {
          console.log("No MONGODB_URI found in desktop embedded mode, starting without MongoDB connection.");
        } else {
          console.log("No MONGODB_URI found, starting MongoMemoryServer for demo...");
          const { MongoMemoryServer } = await import("mongodb-memory-server");
          const mongod = await MongoMemoryServer.create();
          const uri = mongod.getUri();
          console.log("MongoMemoryServer URI:", uri);
          await mongoose.connect(uri);
          console.log("Connected to MongoMemoryServer successfully");
        }
      } else {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB successfully");
      }
    } catch (err) {
      console.error("MongoDB connection error:", err);
      // Don't exit, try to continue for demo purposes if possible
    }

    app.use(cors());
    app.use(express.json());

    // Health check
    app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // API Routes
    console.log("Registering API routes...");
    app.use("/api", apiRoutes);
    console.log("API routes registered");

    // Local DB auto-sync (Mongo -> local JSON snapshot)
    startAutoLocalPull();

    // Skip Mongo-backed bootstrap work when the desktop app is running without a DB connection.
    if (mongoose.connection.readyState === 1) {
      try {
        const existingLicense = await License.findOne({ key: 'HANI-DEMO-2026' });
        if (!existingLicense) {
          await License.create({
            key: 'HANI-DEMO-2026',
            status: 'Active'
          });
          console.log('Bootstrap: Created default license key HANI-DEMO-2026');
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      }
    } else {
      console.log('Skipping license bootstrap because MongoDB is not connected.');
    }

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Setting up Vite middleware...");
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("Vite middleware ready");
      } catch (err) {
        console.error("Vite middleware setup failed:", err);
      }
    } else {
      console.log("Setting up static file serving for production...");
      const distPath = process.env.APP_DIST_PATH || path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`HaniLink Server is now listening on http://0.0.0.0:${PORT}`);
    });

    server.on('error', (err) => {
      console.error("Server listen error:", err);
    });

  } catch (err) {
    console.error("CRITICAL: Failed to start server:", err);
  }
}

export default startServer;
startServer();
