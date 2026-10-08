import { getRedis, parseRecord, RSVP_KEY } from "../lib/redis.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function validate(body) {
  const name = text(body.name, 100);
  const email = text(body.email, 200).toLowerCase();
  const attending = body.attending === "yes" ? "yes" : body.attending === "no" ? "no" : "";

  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!attending) return { error: "Please say whether you're attending." };

  const record = { name, email, attending };
  if (attending === "no") return { record };

  if (typeof body.guest !== "boolean") return { error: "Please say whether you're bringing a guest." };
  record.guest = body.guest;
  record.guestName = body.guest ? text(body.guestName, 100) : "";
  if (record.guest && !record.guestName) return { error: "Please enter your guest's name." };

  const kids = Array.isArray(body.children) ? body.children.slice(0, 12) : [];
  record.children = [];
  for (let i = 0; i < kids.length; i++) {
    const cname = text(kids[i]?.name, 100);
    const age = Number(kids[i]?.age);
    if (!cname || !Number.isInteger(age) || age < 0 || age > 17) {
      return { error: `Please enter a name and age (0–17) for child ${i + 1}.` };
    }
    record.children.push({ name: cname, age });
  }

  record.dietary = text(body.dietary, 1000);

  if (typeof body.anaphylaxis !== "boolean") return { error: "Please answer the anaphylaxis question." };
  record.anaphylaxis = body.anaphylaxis;
  record.anaphylaxisDetails = body.anaphylaxis ? text(body.anaphylaxisDetails, 1000) : "";
  if (record.anaphylaxis && !record.anaphylaxisDetails) {
    return { error: "Please tell us who is anaphylactic, and to what." };
  }
  return { record };
}

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
