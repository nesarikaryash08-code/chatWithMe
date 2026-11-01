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

- Responsive desktop/mobile interface with a plum-and-rose theme, custom chat illustrations, and safety/privacy dialogs.
- Optional opening-line suggestions draft a message without sending it, so users choose their own pace.
- Country → region → searchable city selection, defaulting to Pune, Maharashtra, India.
- Worldwide matching across all countries, with no country/state/city selection required.
- A **Nearest first** switch for City, State, Country, Worldwide, and Nearby. Each area remembers its own preference for the current page session. Off matches any eligible waiting person in that area; on selects the closest eligible waiting person using rounded browser locations.
- Nearest and random modes have separate queues so location sharing is explicit for both participants. Neither silently changes modes or broadens the selected area.
- City/State/Country/Worldwide nearest has no 100 km cap. Nearby alone stays within 100 km; its toggle chooses nearest ordering or any eligible person within that radius.
- Nearest and Nearby require browser location permission. Coordinates round to 0.1 degrees and are never sent to a partner. A denial leaves users out of the queue, with instructions for switching modes themselves. Geolocation requires HTTPS or a loopback development origin. Chosen places are pool preferences, not verified physical locations.
- Matched headers show the friend’s selected city and country (for example, Pune, India). City pools supply this automatically; wider scopes have an optional “Show my city & country in chat” checkbox. Shared cities are validated against their country. These are chosen locations, not verified physical locations; missing cities are labeled as not shared. No reverse geocoding, IP lookup, or coordinates are exposed.
- Real WebSocket chat, typing indicators, recent-message deduplication, session and room validation, message/event rate limits, heartbeat cleanup.
- Next, End, Block, and Report. The last partner is excluded until another match. Blocks last for the temporary session; clearing cookies can evade them.
- Actual live connected-user count; empty pools wait for a real person.
- Messages rendered as text, strict CSP, same-origin WebSocket validation, temporary HttpOnly session cookie.

## Checks

```sh
npm test
node scripts/check-ui.mjs
node scripts/check-matching-ui.mjs
```

Server integration tests use isolated ephemeral ports and temporary report directories. Browser checks require Chromium at `/usr/bin/chromium` (override `CHROMIUM_PATH`) and a running app at port 3000 (override `TEST_URL`). They verify independent sessions, real message delivery, safe rendering, block, dialogs, country search, cancellation and mobile layout. The matching browser checks additionally cover all scope toggles, independent preferences, Worldwide nearest chat, denied geolocation, and cancellation while location lookup is pending. Screenshots are written to `/tmp/chatwithme-{desktop,mobile,conversation}.png`.

## Storage and operation

Sessions, queues, rooms and normal messages live in process memory. Idle disconnected sessions expire after six hours. Restarting loses these; live conversations end immediately on disconnect. There is no reconnect history. Use a single server instance. Nothing is committed or pushed automatically.

Reports append the last 50 room messages, reason, time and temporary participant IDs to `.data/reports.jsonl` (ignored by Git, file mode 0600). Operators must review reports and delete records on their chosen retention schedule. There is **no automatic report review or ban enforcement**. The UI discloses this and does not pretend moderators are online. Normal room messages are discarded when a conversation ends. No persistent IP logging is implemented by this app; the HTTP host may have separate logs.

For an Internet deployment, terminate HTTPS/WSS at a trusted reverse proxy, preserve the public Host/Origin, and set `SECURE_COOKIE=true`. Do not expose the report directory. Development is functional, but a public anonymous-chat launch needs a moderation operation, stronger adult-access and abuse controls, capacity/load testing, and a retention policy. A self-declared 18+ checkbox is not age verification; temporary blocks are not permanent bans. Chat is not end-to-end encrypted.

## Architecture

A small Node.js HTTP/WebSocket backend serves a dependency-free browser frontend. Matching is synchronous within one process so both users are reserved together. City, region, country, Worldwide, and Nearby pools stay separate, as do nearest and random modes. Nearest matching compares rounded coordinates using haversine distance within the selected pool; it chooses from people currently waiting, not everyone online or future arrivals. This first implementation uses the runtime already available in the workspace rather than Spring Boot/Redis/PostgreSQL. Those can replace server storage/routing later without changing the anonymous product flow. Payments and subscriptions are intentionally outside this first version.
