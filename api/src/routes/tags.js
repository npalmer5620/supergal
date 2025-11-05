import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import authRequired from "../middleware/authRequired.js";
import { validate, schemas } from "../middleware/validate.js";

const r = Router();

// GET all tags
r.get("/", (_req, res) => {
    const tags = db.prepare(
        `SELECT t.id, t.name, COUNT(tg.resource_id) as count
         FROM tags t
         LEFT JOIN taggings tg ON t.id = tg.tag_id
         GROUP BY t.id
         ORDER BY t.name ASC`
    ).all();
    res.json(tags);
});

// GET single tag with tagged resources
r.get("/:id", (req, res) => {
    const tag = db.prepare("SELECT id, name FROM tags WHERE id = ?").get(req.params.id);
    if (!tag) return res.status(404).json({ error: "not_found" });

    // Get posts with this tag
    const posts = db.prepare(
        `SELECT p.id, p.slug, p.title, p.status
         FROM taggings tg
         JOIN posts p ON tg.resource_id = p.id
         WHERE tg.tag_id = ? AND tg.resource_type = 'post'
         ORDER BY p.created_at DESC`
    ).all(tag.id);

    // Get galleries with this tag
    const galleries = db.prepare(
        `SELECT g.id, g.slug, g.title, g.status
         FROM taggings tg
         JOIN galleries g ON tg.resource_id = g.id
         WHERE tg.tag_id = ? AND tg.resource_type = 'gallery'
         ORDER BY g.created_at DESC`
    ).all(tag.id);

    res.json({
        ...tag,
        posts,
        galleries,
    });
});

// POST create tag
r.post("/", authRequired, validate(schemas.tagCreate), (req, res) => {
    const { name } = req.body;
    const id = crypto.randomUUID();

    try {
        db.prepare("INSERT INTO tags(id, name) VALUES(?, ?)").run(id, name);
        res.status(201).json({ ok: true, id, name });
    } catch (error) {
        if (error.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "tag_already_exists" });
        }
        throw error;
    }
});

// PUT update tag name
r.put("/:id", authRequired, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name_required" });

    try {
        const info = db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(name, req.params.id);
        if (!info.changes) return res.status(404).json({ error: "tag_not_found" });
        res.json({ ok: true });
    } catch (error) {
        if (error.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "tag_already_exists" });
        }
        throw error;
    }
});

// DELETE tag
r.delete("/:id", authRequired, (req, res) => {
    const info = db.prepare("DELETE FROM tags WHERE id = ?").run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: "tag_not_found" });
    res.json({ ok: true });
});

// POST add tag to post
r.post("/:id/posts/:post_id", authRequired, (req, res) => {
    const tag = db.prepare("SELECT id FROM tags WHERE id = ?").get(req.params.id);
    if (!tag) return res.status(404).json({ error: "tag_not_found" });

    const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.post_id);
    if (!post) return res.status(404).json({ error: "post_not_found" });

    try {
        db.prepare(
            "INSERT INTO taggings(tag_id, resource_type, resource_id) VALUES(?, ?, ?)"
        ).run(req.params.id, "post", req.params.post_id);
        res.status(201).json({ ok: true });
    } catch (error) {
        if (error.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "post_already_tagged" });
        }
        throw error;
    }
});

// DELETE remove tag from post
r.delete("/:id/posts/:post_id", authRequired, (req, res) => {
    const info = db.prepare(
        "DELETE FROM taggings WHERE tag_id = ? AND resource_type = 'post' AND resource_id = ?"
    ).run(req.params.id, req.params.post_id);

    if (!info.changes) return res.status(404).json({ error: "tagging_not_found" });
    res.json({ ok: true });
});

// POST add tag to gallery
r.post("/:id/galleries/:gallery_id", authRequired, (req, res) => {
    const tag = db.prepare("SELECT id FROM tags WHERE id = ?").get(req.params.id);
    if (!tag) return res.status(404).json({ error: "tag_not_found" });

    const gallery = db.prepare("SELECT id FROM galleries WHERE id = ?").get(req.params.gallery_id);
    if (!gallery) return res.status(404).json({ error: "gallery_not_found" });

    try {
        db.prepare(
            "INSERT INTO taggings(tag_id, resource_type, resource_id) VALUES(?, ?, ?)"
        ).run(req.params.id, "gallery", req.params.gallery_id);
        res.status(201).json({ ok: true });
    } catch (error) {
        if (error.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "gallery_already_tagged" });
        }
        throw error;
    }
});

// DELETE remove tag from gallery
r.delete("/:id/galleries/:gallery_id", authRequired, (req, res) => {
    const info = db.prepare(
        "DELETE FROM taggings WHERE tag_id = ? AND resource_type = 'gallery' AND resource_id = ?"
    ).run(req.params.id, req.params.gallery_id);

    if (!info.changes) return res.status(404).json({ error: "tagging_not_found" });
    res.json({ ok: true });
});

export default r;
