import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DB_PATH || "./data/app.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL"); // Write-Ahead Logging
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`

    CREATE TABLE IF NOT EXISTS users
    (
        id            TEXT PRIMARY KEY,           -- generate UUID in app
        username      TEXT    NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT    NOT NULL,
        email         TEXT UNIQUE,
        is_admin      INTEGER NOT NULL DEFAULT 0, -- 0 = no, 1 = yes
        created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens
    (
        jti        TEXT PRIMARY KEY,
        user_id    TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        revoked    INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

-- IMAGES ---------------------------------------------------
    CREATE TABLE IF NOT EXISTS images
    (
        id          TEXT PRIMARY KEY,
        file_path   TEXT    NOT NULL UNIQUE, -- filesystem or object store key
        sha256      TEXT UNIQUE,             -- dedupe
        mime_type   TEXT,
        width       INTEGER,
        height      INTEGER,
        file_size   INTEGER,
        title       TEXT,                    -- optional display title
        alt_text    TEXT,                    -- accessibility
        caption     TEXT,                    -- long caption/credit
        source_url  TEXT,                    -- if imported
        uploaded_by TEXT    REFERENCES users (id) ON DELETE SET NULL,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

-- POSTS (markdown-first) -----------------------------------
    CREATE TABLE IF NOT EXISTS posts
    (
        id                TEXT PRIMARY KEY,
        slug              TEXT    NOT NULL COLLATE NOCASE UNIQUE,
        title             TEXT    NOT NULL,
        body_markdown     TEXT    NOT NULL,
        body_html         TEXT, -- optional cache
        status            TEXT    NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        author_id         TEXT    REFERENCES users (id) ON DELETE SET NULL,
        featured_image_id TEXT    REFERENCES images (id) ON DELETE SET NULL,
        created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at        INTEGER,
        published_at      INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id);

-- GALLERIES -----------------------------------------------
    CREATE TABLE IF NOT EXISTS galleries
    (
        id             TEXT PRIMARY KEY,
        slug           TEXT    NOT NULL COLLATE NOCASE UNIQUE,
        title          TEXT    NOT NULL,
        description    TEXT,
        cover_image_id TEXT    REFERENCES images (id) ON DELETE SET NULL,
        status         TEXT    NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'published', 'archived')),
        author_id      TEXT    REFERENCES users (id) ON DELETE SET NULL,
        created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at     INTEGER,
        published_at   INTEGER
    );

-- Ordering is important for galleries: keep a stable position
    CREATE TABLE IF NOT EXISTS gallery_images
    (
        gallery_id       TEXT    NOT NULL REFERENCES galleries (id) ON DELETE CASCADE,
        image_id         TEXT    NOT NULL REFERENCES images (id) ON DELETE CASCADE,
        position         INTEGER NOT NULL, -- 1-based or 0-based; your call
        caption_override TEXT,             -- optional per-image caption for this gallery
        PRIMARY KEY (gallery_id, image_id),
        UNIQUE (gallery_id, position)
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_images_gallery_pos
        ON gallery_images (gallery_id, position);

-- Optional: link posts <-> galleries if posts can embed multiple galleries
    CREATE TABLE IF NOT EXISTS post_galleries
    (
        post_id    TEXT    NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
        gallery_id TEXT    NOT NULL REFERENCES galleries (id) ON DELETE CASCADE,
        position   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (post_id, gallery_id),
        UNIQUE (post_id, position)
    );

-- TAGS (reusable across posts & galleries) ----------------
    CREATE TABLE IF NOT EXISTS tags
    (
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
    CREATE TABLE IF NOT EXISTS taggings
    (
        tag_id        TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL CHECK (resource_type IN ('post', 'gallery')),
        resource_id   TEXT NOT NULL, -- references posts.id or galleries.id
        PRIMARY KEY (tag_id, resource_type, resource_id)
    );

    -- TRIGGERS: keep updated_at fresh -------------------------
    CREATE TRIGGER IF NOT EXISTS trg_posts_updated_at
        AFTER UPDATE
        ON posts
    BEGIN
        UPDATE posts SET updated_at = unixepoch() WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_galleries_updated_at
        AFTER UPDATE
        ON galleries
    BEGIN
        UPDATE galleries SET updated_at = unixepoch() WHERE id = NEW.id;
    END;

-- FULL-TEXT SEARCH (titles + markdown body) ----------------
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts
        USING fts5
    (
        title,
        body_markdown,
        content='posts',
        content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS posts_ai
        AFTER INSERT
        ON posts
    BEGIN
        INSERT INTO posts_fts(rowid, title, body_markdown)
        VALUES (new.rowid, new.title, new.body_markdown);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_ad
        AFTER DELETE
        ON posts
    BEGIN
        INSERT INTO posts_fts(posts_fts, rowid, title, body_markdown)
        VALUES ('delete', old.rowid, old.title, old.body_markdown);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_au
        AFTER UPDATE
        ON posts
    BEGIN
        INSERT INTO posts_fts(posts_fts, rowid, title, body_markdown)
        VALUES ('delete', old.rowid, old.title, old.body_markdown);
        INSERT INTO posts_fts(rowid, title, body_markdown)
        VALUES (new.rowid, new.title, new.body_markdown);
    END;
`);
