import { Router } from "express";
import { db } from "../lib/db.js";

const r = Router();

/**
 * Search endpoint using SQLite FTS5
 * GET /search?q=query&type=posts|galleries|all
 */
r.get("/", (req, res) => {
    const { q, type } = req.query;

    if (!q) return res.status(400).json({ error: "query_required" });

    const results = {};

    // Search posts using FTS5
    if (!type || type === "posts" || type === "all") {
        try {
            const postMatches = db.prepare(
                `SELECT p.id, p.slug, p.title, p.status, p.created_at, rank
                 FROM posts_fts fts
                 JOIN posts p ON p.rowid = fts.rowid
                 WHERE posts_fts MATCH ?
                 ORDER BY rank
                 LIMIT 20`
            ).all(q);

            results.posts = postMatches.map((post) => ({
                id: post.id,
                slug: post.slug,
                title: post.title,
                status: post.status,
                created_at: post.created_at,
                relevance: Math.round(Math.abs(post.rank) * 100),
            }));
        } catch (error) {
            results.posts = [];
        }
    }

    // Search galleries - simple text search since no FTS on galleries
    if (!type || type === "galleries" || type === "all") {
        const galleryMatches = db.prepare(
            `SELECT id, slug, title, status, created_at
             FROM galleries
             WHERE title LIKE ? OR description LIKE ?
             ORDER BY created_at DESC
             LIMIT 20`
        ).all(`%${q}%`, `%${q}%`);

        results.galleries = galleryMatches.map((gallery) => ({
            ...gallery,
            relevance: 0, // Simple match, no ranking
        }));
    }

    // Search images - simple text search
    if (!type || type === "images" || type === "all") {
        const imageMatches = db.prepare(
            `SELECT id, file_path, title, caption, created_at
             FROM images
             WHERE title LIKE ? OR caption LIKE ?
             ORDER BY created_at DESC
             LIMIT 20`
        ).all(`%${q}%`, `%${q}%`);

        results.images = imageMatches.map((image) => ({
            ...image,
            relevance: 0,
        }));
    }

    // Calculate total results
    const total = Object.values(results).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    res.json({
        query: q,
        total,
        results,
    });
});

/**
 * Search by tag
 * GET /search/tags/:tag_id
 */
r.get("/tags/:tag_id", (req, res) => {
    const tag = db.prepare("SELECT id, name FROM tags WHERE id = ?").get(req.params.tag_id);
    if (!tag) return res.status(404).json({ error: "tag_not_found" });

    // Get posts with this tag
    const posts = db.prepare(
        `SELECT p.id, p.slug, p.title, p.status, p.created_at
         FROM taggings tg
         JOIN posts p ON tg.resource_id = p.id
         WHERE tg.tag_id = ? AND tg.resource_type = 'post'
         ORDER BY p.created_at DESC`
    ).all(req.params.tag_id);

    // Get galleries with this tag
    const galleries = db.prepare(
        `SELECT g.id, g.slug, g.title, g.status, g.created_at
         FROM taggings tg
         JOIN galleries g ON tg.resource_id = g.id
         WHERE tg.tag_id = ? AND tg.resource_type = 'gallery'
         ORDER BY g.created_at DESC`
    ).all(req.params.tag_id);

    res.json({
        tag: {
            id: tag.id,
            name: tag.name,
        },
        posts,
        galleries,
    });
});

export default r;
