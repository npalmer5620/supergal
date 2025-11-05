import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "node:path";
import { ensureDirs, uploadDir } from "./lib/files.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import imageRoutes from "./routes/images.js";
import galleryRoutes from "./routes/galleries.js";
import tagRoutes from "./routes/tags.js";
import searchRoutes from "./routes/search.js";
import errorMiddleware from "./middleware/error.js";

// CORS middleware
function corsMiddleware(req, res, next) {
    const origin = req.get("origin");
    // In development, allow all origins. In production, restrict to frontend domain
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin || "*");
    }
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
}

export function createApp() {
    ensureDirs();
    const app = express();

    app.use(corsMiddleware);
    app.use(morgan("dev"));
    app.use(cookieParser());
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // static files (served by API so your proxy can route /uploads/* here)
    app.use("/uploads", express.static(uploadDir()));

    app.get("/health", (_req, res) => res.json({ ok: true }));

    app.use("/api/auth", authRoutes);
    app.use("/api/posts", postRoutes);
    app.use("/api/images", imageRoutes);
    app.use("/api/galleries", galleryRoutes);
    app.use("/api/tags", tagRoutes);
    app.use("/api/search", searchRoutes);

    app.use(errorMiddleware);
    return app;
}
