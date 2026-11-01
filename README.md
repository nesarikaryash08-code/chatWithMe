# ChatWithMe

Anonymous, location-based text chat. No signup, login, email, phone number, profile, or fake chat partners. Open the app in **two separate browser profiles or incognito contexts** to try a real conversation. Tabs in the same browser share one temporary session; only one connected tab per session is allowed.

## Run

Requires Node.js 22+ (tested with 24.19).

```sh
npm ci
npm start
```

The server listens on port 3000; override with `PORT`. `npm run dev` restarts the server when backend files change. Refresh the browser after frontend changes. No database or API keys required. The worldwide country/state/city directory is bundled by `country-state-city` and works without third-party API requests. Coverage reflects that dataset; it is not a live, exhaustive registry of every settlement. Countries without listed regions can use country matching.

## Included

- Responsive desktop/mobile interface, custom illustrations, safety/privacy dialogs.
- Country → region → searchable city selection, defaulting to Pune, Maharashtra, India.
- Same-pool random matching; scopes never broaden without an explicit user action.
- Optional nearest available matching within 100 km, with browser location permission. Coordinates round to 0.1 degrees and are never sent to a partner. Geolocation requires HTTPS or a loopback development origin.
- Real WebSocket chat, typing indicators, recent-message deduplication, session and room validation, message/event rate limits, heartbeat cleanup.
- Next, End, Block, and Report. The last partner is excluded until another match. Blocks last for the temporary session; clearing cookies can evade them.
- Actual live connected-user count; empty pools wait for a real person.
- Messages rendered as text, strict CSP, same-origin WebSocket validation, temporary HttpOnly session cookie.

## Checks

```sh
npm test
node scripts/check-ui.mjs
```

Server integration tests use isolated ephemeral ports and temporary report directories. Browser checks require Chromium at `/usr/bin/chromium` (override `CHROMIUM_PATH`) and a running app at port 3000 (override `TEST_URL`). They verify two independent sessions, real message delivery, safe rendering, block, dialogs, country search, cancellation and mobile layout. Screenshots are written to `/tmp/chatwithme-{desktop,mobile,conversation}.png`.

## Storage and operation

Sessions, queues, rooms and normal messages live in process memory. Idle disconnected sessions expire after six hours. Restarting loses these; live conversations end immediately on disconnect. There is no reconnect history. Use a single server instance. Nothing is committed or pushed automatically.

Reports append the last 50 room messages, reason, time and temporary participant IDs to `.data/reports.jsonl` (ignored by Git, file mode 0600). Operators must review reports and delete records on their chosen retention schedule. There is **no automatic report review or ban enforcement**. The UI discloses this and does not pretend moderators are online. Normal room messages are discarded when a conversation ends. No persistent IP logging is implemented by this app; the HTTP host may have separate logs.

For an Internet deployment, terminate HTTPS/WSS at a trusted reverse proxy, preserve the public Host/Origin, and set `SECURE_COOKIE=true`. Do not expose the report directory. Development is functional, but a public anonymous-chat launch needs a moderation operation, stronger adult-access and abuse controls, capacity/load testing, and a retention policy. A self-declared 18+ checkbox is not age verification; temporary blocks are not permanent bans. Chat is not end-to-end encrypted.

## Architecture

A small Node.js HTTP/WebSocket backend serves a dependency-free browser frontend. Matching is synchronous within one process so both users are reserved together. Country, region and city pools stay separate; nearest matching uses rounded coordinates and the haversine distance. This first implementation uses the runtime already available in the workspace rather than Spring Boot/Redis/PostgreSQL. Those can replace server storage/routing later without changing the anonymous product flow. Payments and subscriptions are intentionally outside this first version.
