import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { db } from "../lib/db.js";
import authRequired from "../middleware/authRequired.js";
import { originalDir, resolveImageUrls } from "../lib/files.js";
import { processImage, deleteThumbnails } from "../lib/imageProcessor.js";

// Calculate SHA256 hash of a file
function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = createReadStream(filePath);
        stream.on("data", (data) => hash.update(data));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, originalDir()),
    filename: (_req, file, cb) => {
        const id = crypto.randomUUID();
        cb(null, id + path.extname(file.originalname || ".jpg"));
    }
});
const upload = multer({ storage });

const r = Router();

function buildImageResponse(image) {
    if (!image) return null;
    const { filename, urls } = resolveImageUrls(image.file_path);
    return {
        ...image,
        filename,
        urls,
        thumbnails: {
            small: urls.thumbnail200,
            medium: urls.thumbnail500,
            large: urls.thumbnail1000,
        },
    };
}

r.get("/", (_req, res) => {
    const rows = db.prepare(
        "SELECT id,file_path,title,mime_type,width,height,file_size,caption,alt_text,created_at FROM images ORDER BY created_at DESC"
    ).all();

    const enriched = rows.map(buildImageResponse).filter(Boolean);

    res.json(enriched);
});

r.get("/:id", (req, res) => {
    const image = db.prepare(
        "SELECT id,file_path,title,mime_type,width,height,file_size,caption,alt_text,sha256,created_at FROM images WHERE id=?"
    ).get(req.params.id);
    if (!image) return res.status(404).json({ error: "not_found" });

    res.json(buildImageResponse(image));
});

r.post("/", authRequired, upload.single("image"), async (req, res) => {
    try {
        const id = path.parse(req.file.filename).name;
        const rel = `original/${req.file.filename}`;
        const fullPath = path.join(originalDir(), req.file.filename);

        // Calculate SHA256 hash
        const sha256 = await hashFile(fullPath);

        // Get file stats for size
        const stats = fs.statSync(fullPath);
        const fileSize = stats.size;

        // Get MIME type from multer
        const mimeType = req.file.mimetype || "application/octet-stream";

        // Process image: detect dimensions and generate thumbnails
        let imageMetadata = { width: null, height: null, thumbnails: {} };
        try {
            imageMetadata = await processImage(fullPath, req.file.filename);
        } catch (error) {
            console.error("Image processing failed:", error.message);
            // Continue with upload even if processing fails
        }

        // Store metadata in database
        db.prepare(
            `INSERT INTO images(id,file_path,title,mime_type,file_size,sha256,caption,alt_text,uploaded_by,width,height)
             VALUES(?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
            id,
            rel,
            req.body.title || null,
            mimeType,
            fileSize,
            sha256,
            req.body.caption || null,
            req.body.alt_text || null,
            req.auth.uid,
            imageMetadata.width,
            imageMetadata.height
        );

        res.status(201).json({
            ok: true,
            id,
            path: `/uploads/${rel}`,
            mime_type: mimeType,
            file_size: fileSize,
            sha256,
            width: imageMetadata.width,
            height: imageMetadata.height,
            thumbnails: imageMetadata.thumbnails,
        });
    } catch (error) {
        // Clean up uploaded file on error
        try {
            const fullPath = path.join(originalDir(), req.file.filename);
            fs.unlinkSync(fullPath);
        } catch (e) {
            // ignore
        }
        res.status(500).json({ error: "upload_failed", message: error.message });
    }
});

export default r;
