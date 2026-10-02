# Sushi Showdown

Room-based sushi scorekeeping with profile selection, private host/player links, and shared floating emoji reactions.

**Live site:** https://sushi-showdown.turtlecap.chatgpt.site

## Features

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

## Portable-source boundary

This is an app-only export of the live room/profile/emoji implementation. Platform-specific deployment and connector infrastructure, private runtime configuration, and unrelated starter components are intentionally excluded. Standard public Vinext/Cloudflare configuration replaces that infrastructure.

Original-game organizer recovery depends on verified platform identity in the live site. In this portable export, lib/organizer-identity.ts deliberately returns no identity and /recover explains the missing integration. Normal rooms, profile claiming, existing private links, counters, and emojis work without it. To enable organizer recovery in your own deployment, implement a trusted identity-provider adapter, securely set LEGACY_OWNER_EMAIL, and connect the recovery UI. Never trust caller-supplied identity headers on a public Worker. The live site's recovery configuration is unchanged.

## Verification

The live implementation was tested for 12 simultaneous claims yielding one owner, own-profile-only permissions, host-wide controls, cross-room isolation, atomic increments, safe retries, emoji cooldown/expiry, and preservation of participant IDs/names/counts. A before/after test using the previous built release verified that its issued host/player cookies and private links remained valid after the update.

The portable export is separately typechecked and built. No general app-level rate limit or automatic room expiry is included. Never commit .env files, credentials, local databases, participant data, node_modules, or build output.
