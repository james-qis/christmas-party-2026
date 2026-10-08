import { Redis } from "@upstash/redis";

// All RSVPs live in one Redis hash: field = lowercase email, value = JSON record.
export const RSVP_KEY = "qis-xmas-2026:rsvps";

// The Vercel Marketplace Upstash integration exposes KV_REST_API_* variables;
// a direct Upstash setup uses UPSTASH_REDIS_REST_*. Accept either.
export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Redis is not configured. Connect an Upstash Redis database to this Vercel project.");
  }
  return new Redis({ url, token });
}

// Upstash auto-parses JSON strings; older values or other clients may return raw strings.
export function parseRecord(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}
