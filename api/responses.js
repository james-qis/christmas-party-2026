import { getRedis, parseRecord, RSVP_KEY } from "../lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const all = (await getRedis().hgetall(RSVP_KEY)) || {};
    const rows = Object.values(all)
      .map(parseRecord)
      .filter(Boolean)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return res.status(200).json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Responses fetch failed:", err);
    return res.status(500).json({ error: "Responses couldn't be loaded." });
  }
}
