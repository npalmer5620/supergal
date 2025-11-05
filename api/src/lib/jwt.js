import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");

export function newJti() { return crypto.randomUUID(); }

export async function signAccess(payload, exp = "15m") {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secret);
}

export async function signRefresh(payload, jti, exp = "7d") {
    return await new SignJWT({ ...payload, jti })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secret);
}

export async function verifyJWT(token) {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload; // { uid, jti?, iat, exp }
}
