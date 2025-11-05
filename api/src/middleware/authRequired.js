import { verifyJWT } from "../lib/jwt.js";

export default async function authRequired(req, res, next) {
    try {
        const bearer = req.get("authorization");
        const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : req.cookies?.access;
        if (!token) return res.status(401).json({ error: "unauthorized" });
        const payload = await verifyJWT(token); // throws if invalid/expired
        req.auth = { uid: payload.uid };
        next();
    } catch {
        res.status(401).json({ error: "unauthorized" });
    }
}
