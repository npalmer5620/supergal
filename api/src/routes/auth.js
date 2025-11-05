import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import { hash, verify as check } from "../lib/passwords.js";
import { newJti, signAccess, signRefresh, verifyJWT } from "../lib/jwt.js";

const r = Router();
const isProd = process.env.NODE_ENV === "production";
const cookieBase = { httpOnly: true, sameSite: "lax", secure: isProd, path: "/" };

function setAuthCookies(res, access, refresh) {
    // Access ~15m
    res.cookie("access", access, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    // Refresh ~7d
    res.cookie("refresh", refresh, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

r.post("/bootstrap", async (req, res) => {
    const { username, password } = req.body ?? {};
    const exists = db.prepare("SELECT 1 FROM users WHERE username=?").get(username);
    if (exists) return res.status(409).json({ error: "user_exists" });
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO users(id,username,password_hash,is_admin) VALUES(?,?,?,1)")
        .run(id, username, await hash(password));
    res.json({ success: true });
});

r.post("/login", async (req, res) => {
    const { username, password } = req.body ?? {};
    const row = db.prepare("SELECT id,password_hash FROM users WHERE username=?").get(username);
    if (!row || !(await check(password, row.password_hash)))
        return res.status(401).json({ error: "bad_credentials" });

    const uid = row.id;
    const jti = newJti();
    const access = await signAccess({ uid });           // 15m
    const refresh = await signRefresh({ uid }, jti);    // 7d default
    db.prepare("INSERT INTO refresh_tokens(jti,user_id,expires_at) VALUES(?,?,unixepoch()+7*24*3600)")
        .run(jti, uid);

    setAuthCookies(res, access, refresh);
    res.json({ success: true });
});

r.post("/refresh", async (req, res) => {
    try {
        const token = req.cookies?.refresh;
        if (!token) return res.status(401).json({ error: "no_refresh" });

        const payload = await verifyJWT(token); // { uid, jti, exp }
        const row = db.prepare("SELECT revoked, expires_at FROM refresh_tokens WHERE jti=?").get(payload.jti);
        if (!row || row.revoked) return res.status(401).json({ error: "revoked" });

        // Rotate refresh token
        db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
        const newJ = newJti();
        db.prepare("INSERT INTO refresh_tokens(jti,user_id,expires_at) VALUES(?,?,unixepoch()+7*24*3600)")
            .run(newJ, payload.uid);

        const access = await signAccess({ uid: payload.uid });
        const refresh = await signRefresh({ uid: payload.uid }, newJ);

        setAuthCookies(res, access, refresh);
        res.json({ success: true });
    } catch {
        res.status(401).json({ error: "invalid_refresh" });
    }
});

r.post("/logout", async (req, res) => {
    // Best-effort revoke provided refresh
    const tok = req.cookies?.refresh;
    try {
        if (tok) {
            const p = await verifyJWT(tok);
            db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(p.jti);
        }
    } catch {}
    res.clearCookie("access", { path: "/" });
    res.clearCookie("refresh", { path: "/" });
    res.json({ success: true });
});

r.get("/me", async (req, res) => {
    // Read access token and return user info
    try {
        const p = await verifyJWT(req.cookies?.access);
        const user = db.prepare("SELECT id, username, email, is_admin FROM users WHERE id=?").get(p.uid);
        if (!user) return res.status(404).json({ error: "user_not_found" });
        res.json(user);
    } catch {
        res.status(401).json({ error: "unauthorized" });
    }
});

r.get("/session", async (req, res) => {
    // Check if refresh cookie is valid and return user info
    // This is the main endpoint for checking authentication on app load
    res.set("Cache-Control", "no-store");
    try {
        const token = req.cookies?.refresh;
        if (!token) return res.status(401).json({ error: "no_session" });

        const payload = await verifyJWT(token); // { uid, jti, exp }
        const row = db.prepare("SELECT revoked, expires_at FROM refresh_tokens WHERE jti=?").get(payload.jti);
        if (!row || row.revoked) return res.status(401).json({ error: "session_revoked" });

        // Refresh token is valid, return user info
        const user = db.prepare("SELECT id, username, email, is_admin FROM users WHERE id=?").get(payload.uid);
        if (!user) return res.status(404).json({ error: "user_not_found" });
        res.json(user);
    } catch {
        res.status(401).json({ error: "invalid_session" });
    }
});

export default r;
