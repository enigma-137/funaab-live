# Hostel life and reliable campus jobs

This change adds one compact shared off-campus courtyard and an instanced room per
student. It extends the existing game; it does not replace the campus, identity,
wallet, social system, minigame engine or avatar renderer.

## Delivery diagnosis and repair

The HUD read `playerRef.current.position`, but that ref was not populated by the
Rapier player. Proximity therefore used `[0,0,0]`. Job acceptance/pickup existed
only in a Zustand store, sports jobs skipped pickup, and completion ignored the
boolean returned by `grantJobReward`. Failed payouts still cleared the job and
displayed success. Each claim generated a timestamp job ID and sent a client-priced
reward, rather than referencing a durable run.

The HUD now uses `myPosition`. SQL job runs preserve acceptance, pickup, completion
and reward status. Four configured jobs have visible world markers. The Worker
derives user identity from its authenticated socket and checks its tracked campus
position, not a destination or reward in the action packet. SQL checks the expected
stage, correct coordinates, minimum elapsed time, cooldown and daily count. A single
transaction credits the existing wallet, appends its ledger and completes the run.
Failed requests retain the job and show a retry/reload message. Refresh reloads the
active run; repeating a completed run does not issue another reward.

Positions are still client-simulated, as in the existing game. The new bounded
movement budget rejects instant objective teleports; this is not a full authoritative
physics or bot-detection system. Five-minute per-job cooldowns, a 15-second stage
minimum and a 12-job rolling daily cap limit farming.

## World, room and social architecture

- Campus: `world:funaab:main`.
- Shared exterior: `world:funaab:hostel`.
- Personal instance: `world:funaab:hostel-room:<ownerUserId>`.
- Go Hostel is available near the main gate and from the campus phone. Go Campus
  returns to the existing gate approach. Transitions remount the physics world,
  clear stale movement targets and reconnect to the correct Durable Object.
- Each room has a plain floor/walls/window, mattress, bucket and basic light.
  A profile trigger supplies rooms for future accounts; migration 007 backfills
  existing owners without changing their identity, wallet or inventory rows.
- Privacy is private, friends, or invite-only (default). Invitations are persisted,
  restricted to accepted/unblocked friends and expire after two hours. The invited
  player can accept, decline or leave. Owners can revoke invitations.
- The Worker checks access before sending a snapshot, binds join messages to the
  requested room and enforces owner plus four guests. Periodic access revalidation
  and owner change notifications remove revoked guests. Separate Durable Objects
  isolate presence, movement, chat and PS matches.
- Furniture loads through an authorized snapshot RPC, then refetches on owner
  invalidation or a ten-second refresh. It is never in movement packets.
- Existing PS gameplay is reused at home once a TV and console are placed. TV state
  persists and is shared. Sit/stand and a short sleep fade support roleplay; sleeping
  records a rested timestamp and issues no currency.

## Shop, placement and credit

`src/config/hostelShop.ts` defines the display catalogue, stable IDs and model keys.
The matching database catalogue is the price authority; clients submit only item ID
and payment choice. Prices range from ₦50 water/plate to ₦1,500 console (rebalanced in migration 012). Categories:
Room, Entertainment, Power, Foodstuff and Basics (including cooking supplies).
`HostelItemModel` uses small procedural meshes and exposes a future GLB boundary at
`/models/hostel/<modelKey>.glb`. No external models or large textures are added.

Purchases reuse `inventory`. Profile/wallet locks, request receipts, unique durable
ownership and atomic inventory/ledger writes prevent duplicate charges. The old
food RPC is wrapped to reject reserved hostel IDs, obsolete purchase overloads and
the client-priced job RPC lose client execution grants, and direct client inventory
writes are revoked. Existing food RPC callers continue through the canonical wrapper.

Placement uses ten named floor, wall, desk and bed anchors with a preview and
Rotate/Cancel/Place controls. Move and removal reuse the same ownership checks.
Occupied anchors and invalid rotations/types are rejected in SQL. Desk items require
a Small Table at floor-b; desk items must be removed before that table moves. Wall
pieces face into the room. Only an owner can edit placements; guests can inspect.

Selected entertainment/power items offer optional fictional credit: 10% game fee,
₦1,500 outstanding limit, due after 48 real hours, followed by a 24-hour grace period.
An outstanding debt blocks duplicate borrowing for that item; overdue balances block
new borrowing. Debts persist independently of placements and are never erased by
removing furniture. Full repayment locks the wallet/debt and appends one ledger entry;
repeat payments are harmless. Phone → Wallet → Iya Ibeji Debts is always available.

After the grace period, approaching the courtyard security post causes a short
fictional pause and opens the debt panel. Debt remains until paid. This is game
comedy, without real-world arrest, interest accrual, forced deductions or legal claims.

## Earnings and balance

| Loop | Fixed game reward | Guard |
| --- | ---: | --- |
| Floral World → COLENG delivery | ₦500 (long delivery) | Pickup, route, 15s minimum, run receipt |
| Health Centre → Senate dispatch | ₦350 | Same persistent job protocol |
| Sports Centre pitch check | ₦300 | Collect equipment and finish check |
| Game Den controller shift | ₦250 | Collect kit and finish station check |
| Campus PS match | Winner ₦250, loser ₦100, draw ₦150 each | Distinct players, server match state, 2m cooldown, 6 rewarded matches/24h, max 2 rewarded vs the same opponent/24h |
| First job of the day | +₦200 bonus | Once per Africa/Lagos day, paid with the first completed job |

Home PS matches grant no money. There are no wagers or player-funded prizes.
PS payouts are idempotent by match/user. A durable retry queue recovers temporary
database failures; its alarm retries the same receipt. Wallets refresh after a
successful live payout or when reopened. Existing starting balances, Keke fares,
food purchases and lawn fines are not reset.

## Mobile and operational boundaries

The hostel panel is a scrollable bottom sheet on phones, with 44px controls,
keyboard focus trapping, Escape close, visible errors and disabled pending actions.
The scene remains visible above the placement controls. Existing touch movement,
camera, chat and avatars are reused. This is a compact MVP: no city, rent, survival,
cooking simulation, real payments, player businesses or new onboarding.

The legacy `npm run server` remains a campus-only mock for older regressions. It
explicitly rejects hostel joins and returns a useful error for persistent jobs.
Use `npm run worker:dev` for the actual authenticated hostel/job protocol, against
a separate development Supabase project. Do not test with production data.

## Required rollout — manual, not performed by this implementation

1. Review and run **`supabase/migrations/007_hostel_life.sql`** once in Supabase SQL
   Editor, after 001–006. Do not rerun or edit previously applied migrations.
2. Add **`SUPABASE_SERVICE_ROLE_KEY`** as a Cloudflare Worker secret for the same
   Supabase project. It must never use a `VITE_` prefix, appear in frontend variables,
   source control or browser code. Existing `SUPABASE_URL` and auth settings remain.
   Keep production `ENABLE_GUEST_MODE` disabled. No new Durable Object binding or
   Cloudflare class migration is needed.
3. Deploy the updated Worker, then the frontend. This implementation has not applied
   production SQL, installed a secret, pushed a commit or triggered deployments.
4. Smoke-test an existing beta user, a new user and two real authenticated students:
   purchase/reload/placement, invitation/leave/revoke, one delivery and a PS reward.

Only the private Worker needs the service-role secret. It bridges verified socket
positions and completed matches to service-role-only reward RPCs. Purchases, debts,
placements and invites use the player's existing Supabase session directly.

## Reproducible verification

Standard checks: frontend TypeScript, Worker TypeScript, production build, the eight
existing regression scripts, student-journey logic, avatar presence and student SQL.
New checks:

- `npm run test:hostel:db`: isolated PGlite database; all seven migrations, preservation,
  checkout/retry, credit/payment, placement, privacy/RLS, job replay/ledger and PS caps.
- `npm run test:hostel:worker`: real Worker class with isolated sockets and mocked
  database transport; access/capacity, room scoping, spoofed job packets, PS completion
  and durable retry. Does not call production.
- `npm run test:hostel:browser`: local Vite at port 5178 with synthetic Supabase
  responses and intercepted sockets; mobile/desktop purchase, placement, refresh,
  move/removal and credit repayment. Database security is checked separately above.

Use `PGLITE_MODULE`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` for optional local
test runtimes. Browser tests require synthetic `VITE_SUPABASE_URL=https://student-test.supabase.co`,
`VITE_SUPABASE_ANON_KEY=test-public-anon-key`, and local `VITE_WS_URL=ws://127.0.0.1:8787`.
No production credentials are needed by the tests. Screenshots go to ignored test-results.

The isolated SQL and Worker suites passed, including repeated writes, permission
denials, a completed two-player PS match and its failed-payment retry. The hostel
browser flow passed at 360×800 and 1440×1000, including placement after refresh and
credit repayment. Existing campus regressions, avatar presence, signup/login/session
restoration and shortened beta onboarding also passed. The production build succeeds;
Vite still warns about large Three/Rapier game chunks. These are local/synthetic
verification results, not live production data or provider deployment checks.

Deferred: Blender GLBs, freeform furniture dragging, partial debt repayment, cooking,
electricity/fuel simulation, rent, host business income, cross-world realtime DMs
(existing persistence remains), and full server physics. Live provider authentication,
email and real mobile hardware remain deployment smoke tests.
