import crypto from "crypto";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenSecret = () => process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "saifee-rovers-local-development-secret" : "");

export function createToken(payload, expiresInSeconds = 8 * 60 * 60) {
  const secret = tokenSecret();
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  const [header, body, signature] = String(token || "").split(".");
  const secret = tokenSecret();
  if (!header || !body || !signature || !secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
}
