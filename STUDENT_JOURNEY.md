# Student journey implementation and rollout

This pass extends the React/Vite, Zustand, React Three Fiber/Rapier, Supabase and
Cloudflare Durable Object game. Existing wallet, friends, jobs, chat, transport,
security, lecture and Game Den systems remain in place.

## Rollout order

1. Run **supabase/migrations/006_student_journey.sql** manually in Supabase SQL Editor,
   after migrations 001 through 005. Run it once. It is transactional and additive.
   No existing migration has been edited.
2. Deploy the updated Cloudflare Worker. It adds `avatar_update` / `avatar_updated`
   and the read-only `/campus-summary` endpoint. No new environment variable, secret,
   Durable Object binding or Cloudflare migration is required.
3. Build and deploy the frontend through the existing deployment process.
4. Smoke-test one existing beta account and one new account against the deployed
   services. The implementation was verified with local services and synthetic data;
   this pass does not apply production SQL, publish the frontend or deploy the Worker.

The SQL is required before this frontend is released. If setup is unavailable, the
entry screen provides retry and sign-out, with no destructive fallback or account reset.

## Data and state

- `profiles`: adds `onboarding_completed`, `course_id`, `game_matric_number`. Existing
  `avatar_config` JSONB is reused. Game identity is separate from the auth UUID.
- `student_journeys`: owner-only beta marker, admission draft, story completion,
  orientation steps/completion and one-time badge timestamp. Profiles present at
  migration time are backfilled as beta players; later profiles default to new.
- `game_courses`: the fictional catalogue, with invented game cutoff values.
- `game_matric_sequence`: server-owned sequence plus a unique profile constraint.
- RPCs: `ensure_student_journey`, `accept_game_admission`, `complete_student_profile`,
  `claim_orientation_badge`. Authenticated identity comes from `auth.uid()`.
- Public profile fields continue using existing profile read rules. Drafts and
  orientation internals live in the private table. Direct clients cannot assign
  matric numbers, mark onboarding complete, change beta status or award badges.

Auth profile mapping now restores the student fields and normalizes legacy avatars.
Auth recovery/signup uses insert-if-missing rather than overwriting profiles. Direct
wallet upserts/bonus inserts were removed from auth; the existing idempotent
`ensure_player_wallet` bootstrap remains responsible for wallets. Persistent Supabase
sessions remain enabled. No guest mode is introduced or enabled.

## Entry flows

New students follow welcome, profile, application, fictional UTME, three-question
screening, admission, student identity, avatar and campus entry. Submitted stages
persist in Supabase so refresh resumes the story. UTME and screening affect the
offer; alternatives with zero game cutoff ensure nobody is permanently rejected.
Simulation disclaimers are visible. No JAMB credentials or state-of-origin data are
collected. The signup username is reused; body presentation is chosen in the editor.

Accepting admission reserves a unique, stable game matric. Completion only succeeds
after the profile/avatar RPC succeeds. Errors remain retryable and do not open campus.
Existing beta players get course/identity/avatar completion and skip the story.

Returning players get their student card, live aggregate campus counts/popular zones,
profile, avatar and friends access. Summary fetches do not join the multiplayer room.
Campus connects and mounts only after Enter Campus. Entry is on the ceremonial road
at `[0, 0, 48]`, clear of the main gate monument. Network disconnect cancels pending
connect/reconnect work; avatar changes do not reconnect the player.

## Avatars and multiplayer

`src/config/avatar.ts` normalizes and bounds the schema:

```
bodyType, skinTone, hairstyle, hairColor,
topStyle, topColor, bottomStyle, bottomColor, shoeStyle, shoeColor
```

Legacy `shirtColor` and `skinColor` aliases remain for existing UI/clients. Options:
two bodies; five skin swatches; low cut, short afro, fade, short twists, natural puff,
braids, bun and short natural hair; five tops; trousers/jeans/joggers/skirt; sneakers
and flats. Five outfit presets preserve body, hair and skin choices.

`AvatarBody` is a procedural renderer shared by previews, local/remote players and
classroom seats. It uses low-segment geometry, shared per-avatar materials and
ref-driven idle/walk/run/sit/wave posing without animation-driven React state.
Preview drag rotation and limited zoom load independently of the campus scene.

Appearance travels on joins/snapshots and explicit updates, not movement batches.
Both the production Worker and local server normalize the payload and derive the
updated player from the socket session. Late joiners receive current appearance.
Classroom avatars resolve appearance from the existing presence state.

## Orientation and mobile

A collapsible, optional checklist tracks Car Park, Keke, college welcome point,
food purchase and selecting a nearby student. Colleges without a dedicated world
building use the Central Lecture Theatre welcome point, named in the checklist.
Orientation awards a one-time **Campus Explorer badge**, not currency. Movement is
client-reported, so it must not mint money. SQL locking and a stable claim timestamp
make repeated badge claims idempotent.

The campus phone groups profile/avatar, friends, messages, wallet, jobs, guide,
inventory, timetable, daily allowance and help. Secondary mobile shortcuts are
hidden, while identity, wallet and contextual controls remain. Light entry/profile
screens scroll independently, use 44px+ controls, support safe areas and retain
reachable actions at reduced keyboard-like viewport heights. The phone/profile
dialog supports Escape, focus trapping and focus restoration. Remote profiles query
only course/matric fields and retain the existing social actions.

## Verification

Run from the repository root:

```
npm run test:student
node test_feedback_pass.cjs
node test_funaab_systems.cjs
npm run worker:typecheck
npm run build
```

Start `npm run server`, then run `node test_economy_systems.cjs` and `npm run test:avatar`.
The avatar test covers two peers, session-owned updates, compact movement and a late join.

Optional isolated database/browser test tools are not production dependencies:

```
npm install --no-save --package-lock=false @electric-sql/pglite playwright
npm run test:student:db
```

For browser tests start a separate local Vite instance on port 5178 with
`VITE_SUPABASE_URL=https://student-test.supabase.co` and
`VITE_SUPABASE_ANON_KEY=test-public-anon-key`. These values are synthetic and all
Supabase calls are intercepted. Do not substitute production credentials.

Then run `npm run test:student:browser` and `npm run test:student:auth`.
Set `EXTENDED_ONLY=1` for beta migration, failure retry and keyboard-height checks.
If needed, `CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_MODULE` and `PGLITE_MODULE` can point to
already-installed test runtimes. Browser artifacts go to `test-results/student-journey`.

Verified viewports: 360x800, 390x844, 412x915, 430x932 and 1440x1000.
Coverage includes signup/login/session restoration, admission, draft refresh,
avatar persistence, returning entry, phone editing, beta shortcut, save failure retry,
and horizontal overflow. SQL tests execute all six migrations in isolated Postgres,
exercise owner/other-user/anonymous roles, preserve seeded wallet/friend/inventory data,
and verify unique stable matric identifiers and one-time badge claims.

Production build passes. Vite still reports large game/Three/Rapier chunks; splitting
the campus and editor reduces entry coupling but this is not a complete bundle audit.
Real mobile hardware, live Supabase email delivery and deployed Worker authentication
still need the normal deployment smoke test.

## Blender handoff and postponed work

`src/config/modelManifest.ts` and `public/models/{avatars,buildings,vehicles}` document
the future asset contract. Begin with one body and one hairstyle: metres, Y-up,
+Z forward, feet at origin, approximately 2.1m tall, stable option IDs and shared
bone/seat anchors. Add GLB loading/fallbacks inside AvatarBody and verify mobile cost,
walk/sit poses and tint slots. Profiles and protocol need no schema change.

Actual GLB loading/assets, photorealism, a clothing shop, paid rewards, hostel décor,
official admissions, CGPA, registration, payments and AI lecturers remain postponed.
The optional replay of the admission story for completed beta users is not included.
