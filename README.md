# QIS Christmas Party RSVP

Static RSVP form plus a responses page, hosted on Vercel. Responses are stored in Upstash Redis.

| URL | What it is |
|---|---|
| `/` | Invitation and RSVP form for staff |
| `/responses` | Live list of all responses, totals and CSV download |
| `/api/rsvp` | POST endpoint the form submits to |
| `/api/responses` | GET endpoint the responses page reads |

## Deploy

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo. Framework preset: **Other**. No build settings needed. Deploy.
3. In the Vercel project: **Storage → Create / Connect Database → Upstash for Redis** (free tier is plenty). Connect it to the project for all environments.
4. **Deployments → ⋯ → Redeploy** so the functions pick up the new environment variables.
5. Open `/`, submit a test RSVP, check it appears on `/responses`.

The code reads either `KV_REST_API_URL` / `KV_REST_API_TOKEN` (set by the Vercel Marketplace integration) or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (direct Upstash setup).

## How it behaves

- One response per email address. Submitting again with the same email replaces the earlier response.
- Validation runs in the browser and again on the server.
- A hidden honeypot field silently drops basic bot submissions.
- All pages send `noindex` so search engines won't list them.

## Clearing test data

In the Upstash console, delete the key `qis-xmas-2026:rsvps`, or delete a single field (an email address) from that hash.

## Privacy

`/responses` has no login. Anyone with the URL can see names, emails, children's names and ages, and allergy details. Only share that link with the organisers.
