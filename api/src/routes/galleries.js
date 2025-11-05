import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import authRequired from "../middleware/authRequired.js";
import { validate, schemas } from "../middleware/validate.js";
import { resolveImageUrls } from "../lib/files.js";

const r = Router();
const STATUS_VALUES = ["draft", "published", "archived"];
const galleryImagesStmt = db.prepare(
    `SELECT i.id, i.file_path, i.title, gi.caption_override, gi.position
     FROM gallery_images gi
     JOIN images i ON gi.image_id = i.id
     WHERE gi.gallery_id = ?
     ORDER BY gi.position ASC`
);

function toIsoTimestamp(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        const ms = value < 1e12 ? value * 1000 : value;
        return new Date(ms).toISOString();
    }
    if (typeof value === "string" && value.trim() !== "") {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
            return toIsoTimestamp(numeric);
        }
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }
    return null;
}

function serializeGalleryImage(image) {
    if (!image) return null;
    const { filename, urls } = resolveImageUrls(image.file_path);
    return {
        id: image.id,
        title: image.title,
        filename,
        captionOverride: image.caption_override || null,
        position: image.position,
        urls,
    };
}

function serializeGallery(row, images = null) {
    if (!row) return null;
    const serializedImages = Array.isArray(images) ? images.map(serializeGalleryImage).filter(Boolean) : undefined;
    const rawCount = row.image_count;
    const normalizedCount = (rawCount !== undefined && rawCount !== null)
        ? Number(rawCount)
        : undefined;
    const imageCount = Number.isFinite(normalizedCount) ? normalizedCount : (serializedImages ? serializedImages.length : 0);
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description || null,
        status: row.status,
        authorId: row.author_id || null,
        createdAt: toIsoTimestamp(row.created_at),
        updatedAt: toIsoTimestamp(row.updated_at),
        publishedAt: toIsoTimestamp(row.published_at),
        imageCount,
        images: serializedImages,
    };
}

function findGallery(identifier) {
    return db.prepare(
        `SELECT g.id,
                g.slug,
                g.title,
                g.description,
                g.status,
                g.author_id,
                g.created_at,
                g.updated_at,
                g.published_at,
                (SELECT COUNT(*) FROM gallery_images gi WHERE gi.gallery_id = g.id) AS image_count
         FROM galleries g
         WHERE g.slug = ? OR g.id = ?`
    ).get(identifier, identifier);
}

function listGalleryImages(galleryId) {
    return galleryImagesStmt.all(galleryId);
}

function parseIdList(value) {
    if (Array.isArray(value)) {
        return value
            .map((v) => (typeof v === "string" ? v : String(v ?? "")).trim())
            .filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeImageSelections(imagesValue, orderValue) {
    const hasImagesField = imagesValue !== undefined && imagesValue !== null;
    const hasOrderField = orderValue !== undefined && orderValue !== null;

    if (!hasImagesField && !hasOrderField) {
        return null;
    }

    const selected = parseIdList(imagesValue);
    const order = parseIdList(orderValue);
    const baseSelection = selected.length ? selected : order;
    const allowed = new Set(baseSelection);
    const seen = new Set();
    const result = [];

    const consider = (list) => {
        for (const id of list) {
            if (allowed.size && !allowed.has(id)) continue;
            if (!seen.has(id)) {
                result.push(id);
                seen.add(id);
            }
        }
    };

    consider(order);
    consider(baseSelection);

    return result;
}

const syncGalleryImages = db.transaction((galleryId, imageIds) => {
    db.prepare("DELETE FROM gallery_images WHERE gallery_id = ?").run(galleryId);

    if (!imageIds || !imageIds.length) {
        return 0;
    }

    const placeholders = imageIds.map(() => "?").join(",");
    const existingRows = db.prepare(`SELECT id FROM images WHERE id IN (${placeholders})`).all(...imageIds);
    const validIds = new Set(existingRows.map((row) => row.id));

    const insertStmt = db.prepare(
        "INSERT INTO gallery_images(gallery_id, image_id, position, caption_override) VALUES(?, ?, ?, NULL)"
    );
    let position = 1;
    for (const imageId of imageIds) {
        if (!validIds.has(imageId)) continue;
        insertStmt.run(galleryId, imageId, position++);
    }

    return position - 1;
});

function normalizeGalleryPayload(req, _res, next) {
    if (req.body && typeof req.body === "object" && typeof req.body.slug === "string") {
        req.body.slug = req.body.slug.trim();
    }
    next();
}

function applyGalleryUpdate(req, res) {
    const gallery = findGallery(req.params.slugOrId);
    if (!gallery) return res.status(404).json({ error: "not_found" });

    const { title, description, status, slug, images, imageOrder } = req.body ?? {};
    let query = "UPDATE galleries SET ";
    const updates = [];
    const params = [];

    if (typeof title === "string" && title.length) {
        updates.push("title = ?");
        params.push(title);
    }
    if (description !== undefined) {
        updates.push("description = ?");
        params.push(description || null);
    }
    if (typeof slug === "string" && slug.length) {
        updates.push("slug = ?");
        params.push(slug);
    }
    if (typeof status === "string" && STATUS_VALUES.includes(status)) {
        updates.push("status = ?");
        params.push(status);
        if (status === "published") {
            updates.push("published_at = unixepoch()");
        }
    }

    const imageSelection = normalizeImageSelections(images, imageOrder);
    const hasImageUpdates = imageSelection !== null;

    if (!updates.length && !hasImageUpdates) return res.status(400).json({ error: "no_updates" });

    if (updates.length) {
        updates.push("updated_at = unixepoch()");
        query += updates.join(", ") + " WHERE id = ?";
        params.push(gallery.id);

        const info = db.prepare(query).run(...params);
        if (!info.changes) return res.status(404).json({ error: "not_found" });
    }

    if (hasImageUpdates) {
        syncGalleryImages(gallery.id, imageSelection ?? []);
    }

    const updated = findGallery(gallery.id);
    const imagesRows = listGalleryImages(gallery.id);
    res.json({ ok: true, gallery: serializeGallery(updated, imagesRows) });
}

// GET all galleries
r.get("/", (req, res) => {
    const { tags, status } = req.query;
    let query = `
        SELECT g.id,
               g.slug,
               g.title,
               g.description,
               g.status,
               g.author_id,
               g.created_at,
               g.updated_at,
               g.published_at,
               (SELECT COUNT(*) FROM gallery_images gi WHERE gi.gallery_id = g.id) AS image_count,
               cover.image_id AS cover_image_id,
               cover.position AS cover_position,
               cover_image.file_path AS cover_file_path,
               cover_image.title AS cover_image_title
        FROM galleries g
        LEFT JOIN gallery_images AS cover
            ON cover.gallery_id = g.id
           AND cover.position = 1
        LEFT JOIN images AS cover_image
            ON cover.image_id = cover_image.id
        WHERE 1=1
    `;
    const params = [];

    if (status) {
        const statuses = status
            .split(",")
            .map((s) => s.trim())
            .filter((s) => STATUS_VALUES.includes(s));
        if (statuses.length) {
            query += ` AND status IN (${statuses.map(() => "?").join(",")})`;
            params.push(...statuses);
        }
    }

    if (tags) {
        const tagList = tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        if (tagList.length) {
            query += `
                AND id IN (
                    SELECT DISTINCT resource_id FROM taggings
                    WHERE resource_type = 'gallery'
                    AND tag_id IN (${tagList.map(() => "?").join(",")})
                )
            `;
            params.push(...tagList);
        }
    }

    query += " ORDER BY g.created_at DESC";
    const galleries = db.prepare(query).all(...params);
    const enriched = galleries.map((gallery) => {
        const coverRow = gallery.cover_image_id
            ? [{
                id: gallery.cover_image_id,
                file_path: gallery.cover_file_path,
                title: gallery.cover_image_title,
                caption_override: null,
                position: gallery.cover_position || 1,
            }]
            : undefined;
        return serializeGallery(gallery, coverRow);
    });
    res.json(enriched);
});

// GET single gallery with images
r.get("/:slugOrId", (req, res) => {
    const gallery = findGallery(req.params.slugOrId);
    if (!gallery) return res.status(404).json({ error: "not_found" });

    const images = listGalleryImages(gallery.id);
    res.json(serializeGallery(gallery, images));
});

// POST create gallery
r.post("/", authRequired, normalizeGalleryPayload, validate(schemas.galleryCreate), (req, res) => {
    const { slug, title, description, status } = req.body;
    const id = crypto.randomUUID();
    const galleryStatus = STATUS_VALUES.includes(status) ? status : "draft";

    db.prepare(
        `INSERT INTO galleries(id, slug, title, description, status, author_id)
         VALUES(?, ?, ?, ?, ?, ?)`
    ).run(id, slug, title, description || null, galleryStatus, req.auth.uid);

    const imageSelection = normalizeImageSelections(req.body?.images, req.body?.imageOrder);
    if (imageSelection !== null) {
        syncGalleryImages(id, imageSelection);
    }

    const created = findGallery(id);
    const images = listGalleryImages(id);
    res.status(201).json({ ok: true, gallery: serializeGallery(created, images) });
});

// PUT update gallery
r.put("/:slugOrId", authRequired, normalizeGalleryPayload, validate(schemas.galleryUpdate), (req, res) => {
    return applyGalleryUpdate(req, res);
});

r.patch("/:slugOrId", authRequired, normalizeGalleryPayload, validate(schemas.galleryUpdate), (req, res) => {
    return applyGalleryUpdate(req, res);
});

// DELETE gallery
r.delete("/:slugOrId", authRequired, (req, res) => {
    const info = db.prepare("DELETE FROM galleries WHERE slug = ? OR id = ?").run(req.params.slugOrId, req.params.slugOrId);
    if (!info.changes) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
});

// POST add image to gallery
r.post("/:slugOrId/images", authRequired, (req, res) => {
    const { image_id, caption_override } = req.body;
    if (!image_id) return res.status(400).json({ error: "image_id_required" });

    const gallery = findGallery(req.params.slugOrId);
    if (!gallery) return res.status(404).json({ error: "gallery_not_found" });

    const image = db.prepare("SELECT id FROM images WHERE id = ?").get(image_id);
    if (!image) return res.status(404).json({ error: "image_not_found" });

    const lastImage = db.prepare(
        "SELECT MAX(position) as max_pos FROM gallery_images WHERE gallery_id = ?"
    ).get(gallery.id);
    const nextPosition = (lastImage?.max_pos || 0) + 1;

    db.prepare(
        "INSERT INTO gallery_images(gallery_id, image_id, position, caption_override) VALUES(?, ?, ?, ?)"
    ).run(gallery.id, image_id, nextPosition, caption_override || null);

    res.status(201).json({ ok: true, position: nextPosition });
});

// DELETE remove image from gallery
r.delete("/:slugOrId/images/:image_id", authRequired, (req, res) => {
    const gallery = findGallery(req.params.slugOrId);
    if (!gallery) return res.status(404).json({ error: "gallery_not_found" });

    const info = db.prepare(
        "DELETE FROM gallery_images WHERE gallery_id = ? AND image_id = ?"
    ).run(gallery.id, req.params.image_id);

    if (!info.changes) return res.status(404).json({ error: "image_not_in_gallery" });

    const images = db.prepare(
        "SELECT image_id FROM gallery_images WHERE gallery_id = ? ORDER BY position"
    ).all(gallery.id);

    images.forEach((img, idx) => {
        db.prepare("UPDATE gallery_images SET position = ? WHERE gallery_id = ? AND image_id = ?").run(
            idx + 1,
            gallery.id,
            img.image_id
        );
    });

    res.json({ ok: true });
});

export default r;
