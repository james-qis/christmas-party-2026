import { createHash, timingSafeEqual } from "node:crypto";
import { getRedis, parseRecord, RSVP_KEY } from "../lib/redis.js";
import { validate } from "../lib/validate.js";

// Organiser edits from /responses. Viewing stays open; changing data needs ADMIN_PASSWORD (set in Vercel).
// PUT    { originalEmail, ...rsvp }  replace a response (the email itself can change)
// DELETE { email }                   remove a response

const hash = s => createHash("sha256").update(String(s)).digest();
const passwordOk = (given, expected) => timingSafeEqual(hash(given), hash(expected));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "Editing isn't set up yet. Add an ADMIN_PASSWORD environment variable in Vercel and redeploy." });
  if (!passwordOk(req.headers["x-admin-password"] || "", expected)) {
    return res.status(401).json({ error: "Wrong password." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid request." });

  try {
    const redis = getRedis();

    if (req.method === "DELETE") {
      const email = String(body.email || "").trim().toLowerCase();
      const removed = await redis.hdel(RSVP_KEY, email);
      if (!removed) return res.status(404).json({ error: "That response no longer exists. Press Refresh." });
      return res.status(200).json({ ok: true });
    }

    const originalEmail = String(body.originalEmail || "").trim().toLowerCase();
    const existing = parseRecord(await redis.hget(RSVP_KEY, originalEmail));
    if (!existing) return res.status(404).json({ error: "That response no longer exists. Press Refresh." });

    const { record, error } = validate(body);
    if (error) return res.status(400).json({ error });

    const emailChanged = record.email !== originalEmail;
    if (emailChanged && (await redis.hexists(RSVP_KEY, record.email))) {
      return res.status(409).json({ error: "Another response already uses that email address." });
    }

    record.createdAt = existing.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    await redis.hset(RSVP_KEY, { [record.email]: JSON.stringify(record) });
    if (emailChanged) await redis.hdel(RSVP_KEY, originalEmail);
    return res.status(200).json({ ok: true, record });
  } catch (err) {
    console.error("Admin change failed:", err);
    return res.status(500).json({ error: "The change couldn't be saved. Please try again." });
  }
}
