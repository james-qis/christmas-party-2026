import { getRedis, parseRecord, RSVP_KEY } from "../lib/redis.js";
import { validate } from "../lib/validate.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid request." });

  // Honeypot: real people never see this field. Pretend success so bots move on.
  if (typeof body.trap === "string" && body.trap.trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const { record, error } = validate(body);
  if (error) return res.status(400).json({ error });

  try {
    const redis = getRedis();
    const existing = parseRecord(await redis.hget(RSVP_KEY, record.email));
    const now = new Date().toISOString();
    record.createdAt = existing?.createdAt || now;
    record.updatedAt = now;
    await redis.hset(RSVP_KEY, { [record.email]: JSON.stringify(record) });
    return res.status(200).json({ ok: true, updated: Boolean(existing) });
  } catch (err) {
    console.error("RSVP save failed:", err);
    return res.status(500).json({ error: "Your RSVP couldn't be saved. Please try again, or contact Lisa directly." });
  }
}
