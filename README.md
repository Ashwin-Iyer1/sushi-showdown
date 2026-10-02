# Sushi Showdown

Room-based sushi scorekeeping with profile selection, private host/player links, and shared floating emoji reactions.

**Live site:** https://sushi-showdown.turtlecap.chatgpt.site

## Features

- The default page is a universal create/join lobby. Enter a code to open the room and resume your browser's existing profile, choose an available profile, or add yourself.
- On the Worker, `/?current=1` opens the original game; existing `?room=` and private fragment links work as before.
- Create or join a room without an account
- Choose an available existing profile through a shared room link; claiming is atomic and first-come-first-served
- Once joined, participants can change only their own count and send only their own reactions
- The host can update anyone in the room and issue private player-control links
- Existing host/player links and browser sessions remain valid across the profile-picker update
- Scores are persistent in Cloudflare D1; visible clients refresh every 2 seconds
- Atomic increments, retry-safe operation IDs, nonnegative counts, and versioned client updates prevent lost or stale scores

Profile selection relies on trusting the people who receive the room link. Already-claimed profiles and profiles reserved by a private control link cannot be publicly claimed. Private host/player links grant control to whoever has them; share them only with their intended holder.

## Stack

React 19, TypeScript, Vinext, Vite, Tailwind CSS, shadcn UI primitives, Cloudflare Workers, and D1/SQLite. Drizzle generates schema migrations. The five tables are rooms, participants, score_operations, emote_events, and participant_access. Room identity uses an HttpOnly, Secure, SameSite cookie; data is not stored in localStorage.

## Run locally

Requires Node.js 22.13+ and npm.

1. `npm ci`
2. `npm run db:migrate` to initialize the local database
3. `npm run dev`

For the production build: `npm run typecheck` and `npm run build`. Use `npm start` to preview that build locally.

The all-zero database ID in wrangler.jsonc is a local-development placeholder. Local data lives in ignored .wrangler storage. Database migrations are applied in filename order; do not rewrite already-applied migrations. For a schema change, edit db/schema.ts and run `npm run db:generate`.

## Your own Cloudflare deployment

Create your own D1 database, replace the placeholder database_id in wrangler.jsonc, apply the migrations to that database, and deploy the built Worker with Wrangler. Use your own Cloudflare account and authorization. This repository does not include any live-site deployment credentials, production database identifiers, or participant records. Pushing GitHub commits does not redeploy the existing live site.

## Vercel frontend with an existing persistent backend

`npm run build:vercel` builds the same React interface as static assets. `vercel.json` selects that build instead of trying to run Cloudflare's Vinext server on Vercel. `/api/scoreboard` is a Node Web Standard gateway to `SCOREBOARD_API_ORIGIN`, configured in Vercel's server environment. It preserves room cookies, private-link exchanges, authorization responses, retry operation IDs, and uncached polling. It does not store data in memory, local SQLite, or a separate database. Without a configured backend it fails closed with 503.

The backend must be an existing authorized HTTPS Worker running this scoreboard API with persistent D1. A compatible backend must use host-only room cookies. Do not configure a fresh empty database as if it contained the live game. The currently published service remains at https://sushi-showdown.turtlecap.chatgpt.site; the Vercel frontend's current-game and recovery links return there. The gateway does not implement organizer identity; recovery stays on the original service.

Cookies are scoped to their origin. Existing browser sessions remain valid on the original live URL, and do not automatically appear on a Vercel domain. Old private links continue to work at their original URLs. A holder can use a private link on the new frontend to establish a new-origin session against the same backend, subject to that backend's permission rules. No tokens, room records, deployment credentials, or production database IDs belong in this repository.

Deployment is intentionally pending: verify Ashwin's connected account is actually on Hobby, verify that the backend is authorized and continues to provide free persistent storage, and confirm no paid Marketplace resource or card entry is required. A reachable public API alone does not verify its account billing or guarantee future availability. GitHub pushes do not update the original live Worker.

Official pricing checked October 2, 2026: [Vercel Hobby](https://vercel.com/docs/plans/hobby) is free for personal non-commercial use and usually pauses usage beyond allowances. Vercel application databases are [Marketplace resources](https://vercel.com/docs/storage), so a frontend deployment does not itself provide a shared SQL database. [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage; [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day. These published free tiers do not establish the plan used by the current Sites-managed backend. The 2-second polling interval consumes both request and database allowances.

Run `npm test` to verify gateway configuration, cookie forwarding, preserved backend permission responses, cross-site write rejection, payload limits, and safe handling of unavailable or redirecting backends. Both `npm run build` and `npm run build:vercel` remain supported. For local room integration checks, run `npm run db:migrate`, `npm run build`, `npm start -- --port 8788`, then `node tests/rooms.integration.mjs` in another terminal. This check creates only local test rooms and covers own-score permissions, host controls, retry safety, private links, session restoration and room isolation. The preview uses the same ignored `.wrangler/state` directory as local migrations.

## Portable-source boundary

This is an app-only export of the live room/profile/emoji implementation. Platform-specific deployment and connector infrastructure, private runtime configuration, and unrelated starter components are intentionally excluded. Standard public Vinext/Cloudflare configuration replaces that infrastructure.

Original-game organizer recovery depends on verified platform identity in the live site. In this portable export, lib/organizer-identity.ts deliberately returns no identity and /recover explains the missing integration. Normal rooms, profile claiming, existing private links, counters, and emojis work without it. To enable organizer recovery in your own deployment, implement a trusted identity-provider adapter, securely set LEGACY_OWNER_EMAIL, and connect the recovery UI. Never trust caller-supplied identity headers on a public Worker. The live site's recovery configuration is unchanged.

## Verification

The live implementation was tested for 12 simultaneous claims yielding one owner, own-profile-only permissions, host-wide controls, cross-room isolation, atomic increments, safe retries, emoji cooldown/expiry, and preservation of participant IDs/names/counts. A before/after test using the previous built release verified that its issued host/player cookies and private links remained valid after the update.

The portable export is separately typechecked and built. No general app-level rate limit or automatic room expiry is included. Never commit .env files, credentials, local databases, participant data, node_modules, or build output.
