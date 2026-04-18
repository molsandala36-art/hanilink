import express from "express";
import path from "path";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/api";
import License from "./models/License";
import { startAutoLocalPull } from "./services/localSyncService";

dotenv.config();

const parseAllowedOrigins = () =>
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

let initializationPromise: Promise<void> | null = null;

export const createApp = () => {
  const app = express();
  const allowedOrigins = parseAllowedOrigins();

  app.use(express.json());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"]
  }));

  app.use("/api", apiRoutes);

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "HaniLink-Core",
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      time: new Date()
    });
  });

  if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = process.env.APP_DIST_PATH || path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  return app;
};

export const initializeServerResources = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log("HaniLink server resources are initializing...");

    const MONGODB_URI = process.env.MONGODB_URI;
    try {
      if (!MONGODB_URI) {
        if (process.env.DESKTOP_EMBEDDED === "1" || process.env.SKIP_MONGO_MEMORY === "1" || process.env.VERCEL === "1") {
          console.log("Starting without Mongo cloud connection.");
        } else {
          console.log("Starting MongoMemoryServer for development...");
          const { MongoMemoryServer } = await import("mongodb-memory-server");
          const mongod = await MongoMemoryServer.create();
          const uri = mongod.getUri();
          await mongoose.connect(uri);
          console.log("Connected to local memory DB");
        }
      } else {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to production MongoDB");
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }

    if (!process.env.VERCEL) {
      startAutoLocalPull();
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const demoKey = "HANI-DEMO-2026";
        const existingLicense = await License.findOne({ key: demoKey });

        if (!existingLicense) {
          await License.create({
            key: demoKey,
            status: "Active"
          });
          console.log(`Bootstrap: default key ${demoKey} created.`);
        }
      } catch (err) {
        console.error("Bootstrap setup error:", err);
      }
    }
  })();

  return initializationPromise;
};
