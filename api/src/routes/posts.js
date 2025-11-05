import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import authRequired from "../middleware/authRequired.js";
import { validate, schemas } from "../middleware/validate.js";

const r = Router();

const STATUS_VALUES = ["draft", "published", "archived"];

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

function serializePost(row) {
    if (!row) return null;
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        content: row.body_markdown || "",
        excerpt: row.excerpt || null,
        status: row.status,
        authorId: row.author_id || null,
        createdAt: toIsoTimestamp(row.created_at),
        updatedAt: toIsoTimestamp(row.updated_at),
        publishedAt: toIsoTimestamp(row.published_at),
    };
}

function findPost(identifier) {
    return db.prepare("SELECT * FROM posts WHERE slug = ? OR id = ?").get(identifier, identifier);
}

function normalizePostPayload(req, _res, next) {
    if (req.body && typeof req.body === "object") {
        if (!req.body.body_markdown && typeof req.body.content === "string") {
            req.body.body_markdown = req.body.content;
        }
        if (typeof req.body.slug === "string") {
            req.body.slug = req.body.slug.trim();
        }
    }
    next();
}

function applyPostUpdate(req, res) {
    const { title, body_markdown, status, slug } = req.body ?? {};
    let query = "UPDATE posts SET ";
    const updates = [];
    const params = [];

    if (typeof title === "string" && title.length) {
        updates.push("title=?");
        params.push(title);
    }
    if (typeof body_markdown === "string") {
        updates.push("body_markdown=?");
        params.push(body_markdown);
    }
    if (typeof slug === "string" && slug.length) {
        updates.push("slug=?");
        params.push(slug);
    }
    if (typeof status === "string" && STATUS_VALUES.includes(status)) {
        updates.push("status=?");
        params.push(status);
        if (status === "published") {
            updates.push("published_at=unixepoch()");
        }
    }

    if (!updates.length) return res.status(400).json({ error: "no_updates" });

    updates.push("updated_at=unixepoch()");
    query += updates.join(", ") + " WHERE slug=? OR id=?";
    params.push(req.params.slugOrId, req.params.slugOrId);

    const info = db.prepare(query).run(...params);
    if (!info.changes) return res.status(404).json({ error: "not_found" });
    const lookupKey = (typeof slug === "string" && slug.length) ? slug : req.params.slugOrId;
    const updated = findPost(lookupKey);
    res.json({ ok: true, post: serializePost(updated) });
}

r.get("/", (req, res) => {
    const { tags, status } = req.query;
    let query = `
        SELECT id, slug, title, body_markdown, status, author_id, created_at, updated_at, published_at
        FROM posts
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
                    WHERE resource_type = 'post'
                    AND tag_id IN (${tagList.map(() => "?").join(",")})
                )
            `;
            params.push(...tagList);
        }
    }

    query += " ORDER BY created_at DESC";
    const rows = db.prepare(query).all(...params);
    res.json(rows.map(serializePost));
});

r.get("/:slugOrId", (req, res) => {
    const row = findPost(req.params.slugOrId);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(serializePost(row));
});

r.post("/", authRequired, normalizePostPayload, validate(schemas.postCreate), (req, res) => {
    const { slug, title, body_markdown, status } = req.body;
    const id = crypto.randomUUID();
    const postStatus = STATUS_VALUES.includes(status) ? status : "draft";
    db.prepare(
        "INSERT INTO posts(id,slug,title,body_markdown,status,author_id) VALUES(?,?,?,?,?,?)"
    ).run(id, slug, title, body_markdown, postStatus, req.auth.uid);
    const created = findPost(id);
    res.status(201).json({ ok: true, post: serializePost(created) });
});

r.put("/:slugOrId", authRequired, normalizePostPayload, validate(schemas.postUpdate), (req, res) => {
    return applyPostUpdate(req, res);
});

r.patch("/:slugOrId", authRequired, normalizePostPayload, validate(schemas.postUpdate), (req, res) => {
    return applyPostUpdate(req, res);
});

r.delete("/:slugOrId", authRequired, (req, res) => {
    const info = db.prepare("DELETE FROM posts WHERE slug=? OR id=?").run(req.params.slugOrId, req.params.slugOrId);
    if (!info.changes) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
});

export default r;
