# FUNAAB Life

FUNAAB Life is a browser-based multiplayer campus world inspired by the Federal University of Agriculture, Abeokuta (FUNAAB). Explore the campus, meet other players, visit campus locations, ride a keke, and take part in student-life activities.

This is an independent community project and is not affiliated with or endorsed by FUNAAB.

## Features

- 3D campus world with college buildings, hostels, shops, sports and social spaces.
- Multiplayer avatars, campus chat, friends, and player safety tools.
- Campus keke routes, jobs, a virtual wallet, inventory, and activities.
- Supabase-backed authentication and persistence when configured.
- A local WebSocket server for development and a Cloudflare Worker/Durable Objects backend for deployment.

## Tech stack

- React, TypeScript, Vite, Three.js, React Three Fiber, and Zustand.
- Supabase Auth and Postgres.
- Cloudflare Workers and Durable Objects for the multiplayer backend.

## Requirements

- Node.js 20 or newer and npm.
- Supabase and Cloudflare accounts only if you want to run the persistent database or deploy the multiplayer Worker.

## Getting started

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`.

3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to your Supabase project URL and browser-safe publishable/anon key. Do not put a Supabase service-role key or any other secret in a `VITE_` variable; Vite bundles those values into the browser app.

   For local guest-mode testing without Supabase, set `VITE_ENABLE_GUEST_MODE=true`. Do not enable guest mode for a public deployment unless that is intentional.

4. Start the local multiplayer server and frontend in separate terminals:

   ```sh
   npm run server
   ```

   ```sh
   npm run dev
   ```

   Open the URL printed by Vite (usually `http://localhost:5173`). The local frontend uses `ws://localhost:8787` for multiplayer by default. Set `VITE_WS_URL` only when you need a different WebSocket endpoint.

## Supabase setup

Create a Supabase project, then apply the SQL migrations in `supabase/migrations/` in numerical order using the Supabase SQL Editor or your preferred migration workflow. Configure the project URL and publishable/anon key in `.env`.

The browser key is designed to be public. Protect data with the project's Row Level Security policies. Keep service-role keys and JWT signing secrets on the server/Worker only.

## Cloudflare Worker

For local Worker development:

```sh
npm run worker:dev
```

For local Worker credentials, create the ignored `.dev.vars` file with your own project values:

```dotenv
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALLOWED_ORIGINS=http://localhost:5173
ENABLE_GUEST_MODE=true
```

For deployment, configure `SUPABASE_URL`, `ALLOWED_ORIGINS`, and `ENABLE_GUEST_MODE` as Worker variables for your own project. Replace the configured Supabase project URL in `wrangler.toml` when deploying a fork. Add privileged credentials as Cloudflare secrets, not as checked-in variables:

```sh
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Only configure `SUPABASE_JWT_SECRET` if your deployment requires the legacy HS256 fallback. For deployment, authenticate with Wrangler and run:

```sh
npx wrangler login
npm run worker:deploy
```

Set `VITE_WS_URL` in the frontend deployment environment to the deployed Worker's `wss://` URL.

## Checks and tests

Run the production TypeScript check and frontend build:

```sh
npm run build
```

Run the Worker type check:

```sh
npm run worker:typecheck
```

Focused local test suites include:

```sh
npm run test:student
npm run test:hostel
npm run test:campus
npm run test:room
npm run test:keke:worker
```

Some `:db` and `:browser` test scripts require their corresponding local services or browser-test setup; check the script before running one.

## Project guide

- `src/` — frontend, game world, UI, and shared configuration.
- `server/` — local multiplayer WebSocket server.
- `worker/` — Cloudflare multiplayer Worker and Durable Object.
- `supabase/migrations/` — ordered database schema and policy migrations.
- `scripts/` — focused test and verification scripts.

## Multiplayer lifecycle

The Cloudflare Durable Object runs its 100 ms Keke simulation only while a campus session needs it; movement batches are sent only for changed player or Keke state. The public Keke's state is saved when the last campus player leaves and advanced by elapsed time when the room is next joined. Player movement packets are sent on meaningful position, rotation, or animation changes, with a final stop update.

WebSocket hibernation is not enabled. The Worker currently calls standard `webSocket.accept()` and registers closure-capturing event listeners; a migration must use `ctx.acceptWebSocket()`, the Durable Object `webSocketMessage`/`webSocketClose`/`webSocketError` handlers, and attachments or durable state to restore the current in-memory session/player maps after wake-up. The active campus simulation interval is another obstacle while the autonomous route is moving; hibernation would require moving that work to an alarm or elapsed-time/on-demand model. The client also sends a three-second application heartbeat, so genuinely idle WebSocket connections still generate traffic and would need an explicit hibernation-compatible heartbeat policy.

Additional feature notes: [Hostel Life](./HOSTEL_LIFE.md), [Student Journey](./STUDENT_JOURNEY.md), and [Future Features](./FUTURE_FEATURES.md).

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or pull request. In particular, never commit `.env` files, credentials, or production data.

## License

This project is licensed under the [MIT License](./LICENSE).

## Announcements from Telegram

Send a message to the feedback bot and it appears for every player (live for people online, on next
open or within 3 minutes for everyone else). Only the Telegram ids in `TELEGRAM_ADMIN_IDS` can do it.

```
/notification Maintenance at 9 PM        shows for 24 hours
/notification 6h New joystick controls!  shows for 6 hours (m, h or d; up to 7d)
/notification off                        takes it down
/status    /myid    /help
```

One-time setup (Worker secrets, then point Telegram at the Worker):

```
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET     # any long random string
npx wrangler secret put TELEGRAM_ADMIN_IDS          # your id(s), comma separated (message the bot /myid)
npm run worker:deploy
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://<your-worker-host>/telegram/webhook" \
  --data-urlencode "secret_token=<the same TELEGRAM_WEBHOOK_SECRET>"
```

Players on an old copy of the game also get a "new version is ready — Refresh" prompt after each
deploy (the site publishes `/version.json` with every build).
