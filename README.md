# Sushi Showdown

Live app: https://sushi-showdown.vercel.app

A public, independent sushi scorekeeping app. Anyone can create a room or open one by its six-character code, without an account. New rooms start empty apart from the host's profile at zero sushi.

## Room controls

- The host can adjust any count in their room and issue private player-control links.
- Participants can adjust only their own count and send only their own reactions.
- Entering a room code restores that browser's existing room identity, or offers profile selection and joining.
- Private host/player links establish HttpOnly, Secure, SameSite room cookies. Tokens are hashed in the database and are never stored in localStorage.
- Atomic increments, nonnegative scores, retry operation IDs and versioned snapshots protect counts. Visible clients refresh every two seconds.
- Already-claimed or privately reserved profiles cannot be publicly claimed. Profile selection trusts the people invited to the room; private control links grant control to their holder.

## Vercel and Neon

The Vercel build uses React/Vite static assets plus a Node Web Standard API function. Scores persist in a separate Neon PostgreSQL database through the official serverless driver. Serializable transactions with bounded conflict retries preserve the permission and retry model. There is no in-memory or local SQLite production fallback.

This app starts independently. It does not import the old Sites game, connect to its database, or use the portfolio database. No old-origin proxy or organizer-recovery identity bridge is required.

`vercel.json` specifies the Vercel build and output. Use the native Vercel Neon integration to create a separate `sushi-showdown` resource on the verified `free_v3` plan, then connect it only to the Sushi Showdown project. Native integration configuration supplies `DATABASE_URL`; never send or commit its value. Stop if provisioning requires payment, a paid plan, or an unapproved new account.

After connecting, use native `vercel env pull` to obtain the local ignored environment file. Verify its destination is the new resource, set the nonsecret `SUSHI_NEON_EXPECTED_HOST` to the verified hostname, and run `node --env-file=.env.local scripts/init-neon.mjs`. This explicit operator action refuses any database containing public tables and initializes all five tables in one transaction. It never migrates, overwrites or deletes existing data. Set the nonsecret `NEON_SCHEMA_READY=1` in Vercel only after successful initialization. The API returns 503 until database configuration and this readiness flag exist.

Vercel's account/team was verified on active Hobby. [Hobby](https://vercel.com/docs/plans/hobby) is free for personal non-commercial use within usage limits. [Neon Free](https://neon.com/pricing) currently includes 100 projects, 0.5 GB storage/project and 100 CU-hours/project/month. Polling consumes compute while clients remain active; exceeding free limits may suspend availability. Do not enable paid upgrades or automatic billing thresholds. Public pricing does not replace verification of the newly created resource's actual plan.

## Development and verification

Requires Node.js 24.x and npm 11.6.2. The Vercel install command pins the same npm version for reproducible lockfile handling. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build:vercel`.

Tests run against an isolated PostgreSQL engine without cloud credentials. They cover room creation/joining, own-profile permissions, host controls, twelve concurrent profile claims and retries, private links/cookies, room isolation, reactions, nonnegative scores and serialization retries.

The optional standalone Cloudflare build remains supported with D1: run `npm run db:migrate`, `npm run dev`, or `npm run build` then `npm start`. For local production integration checks, start on port 8788 and run `node tests/rooms.integration.mjs`. Local migrations and preview share ignored `.wrangler/state` storage. The all-zero database ID in `wrangler.jsonc` is a local placeholder.

Never commit `.env` files, credentials, `.vercel` configuration, database records, `.wrangler` storage, `node_modules`, or generated build output. Database schema is defined in `db/postgres-schema.sql` for Neon and `db/schema.ts`/`drizzle/` for optional D1 development.
