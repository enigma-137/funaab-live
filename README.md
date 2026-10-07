# 🎓 FUNAAB Life (V0 Playable MVP)

> **"Lagos Life, but for FUNAAB students."**
> A browser-based multiplayer social campus world built for FUNAAB (Federal University of Agriculture, Abeokuta) students.

---

## 🚀 Key Features in V0

- **3D Low-Poly FUNAAB Campus World**:
  - **Ceremonial Main Gate**: Grand archway with security booth and resumption banners.
  - **Car Park & Keke Terminal**: Dedicated stop for catching campus tricycles.
  - **COLFHEC Academic Complex**: Multi-pillar faculty building.
  - **FUNAAB Microfinance Bank & ATM**: Virtual banking with starter balance and ledger.
  - **Mama Cass Campus Buka**: Food hut selling Jollof rice, chicken, beef suya, shawarma, and drinks.
  - **Iyalode Hostel & Social Chill Square**: Gazebo with lounge seating and palm trees.
  - **FUNAAB Game Den (PlayStation Room)**: 1v1 multiplayer penalty shootout minigame.
  - **Sports Field**: Campus pitch with goalposts and football.
- **Multiplayer & Movement**:
  - 3rd-person avatar with WASD/Arrow keys, smooth camera follow, sprinting (Shift).
  - Procedural animations (walking, running, idle breathing, sitting).
  - Floating nameplate with username and College color badge.
  - Snapshot interpolation at ~10Hz for butter-smooth remote player movement.
- **Live Keke Napep System**:
  - Procedural yellow tricycle that drives automatically along a campus route spline.
  - Enter Keke (`[E]`) with ₦50 fare deduction, ride between stops, and exit whenever.
- **Social & Proximity Chat**:
  - Lightweight nearby chat UI showing college tags.
  - Approach players to add friend, view college profile, mute, block, or report.
- **Server-Authoritative Economy**:
  - ₦5,000 initial resumption bonus.
  - Purchases, fares, and peer-to-peer transfers update the transaction ledger.
- **Data-Driven Architecture**:
  - `src/worlds/funaab/world.json` defines all locations, routes, and interactables without hardcoding in the game engine.

---

## 🛠️ Tech Stack

- **Client**: React 18, TypeScript, Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, Tailwind CSS, Zustand, Lucide Icons.
- **Realtime / Multiplayer**: Cloudflare Workers + Durable Objects (`worker/index.ts`) & built-in local WebSocket dev server (`server/index.ts`).
- **Database & Auth**: Supabase Postgres & Auth (`supabase/migrations/001_initial_schema.sql`) with automatic instant guest/local fallback for zero-setup testing.

---

## 🏁 How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Multiplayer Backend Server
In terminal 1:
```bash
npm run server
```
*(Starts the WebSocket server on `ws://localhost:8787`)*

### 3. Start the Frontend Dev Server
In terminal 2:
```bash
npm run dev
```
*(Opens Vite on `http://localhost:5173`)*

---

## 🧪 How to Test Multiplayer (Two Browser Windows)

1. Open **Browser A** at `http://localhost:5173`.
2. Enter username **Emmanuel**, select college **COLENG**, and click **"Enter FUNAAB Campus"**.
3. Open **Browser B** (or an Incognito window) at `http://localhost:5173`.
4. Enter username **Tobi**, select college **COLFHEC**, and click **"Enter FUNAAB Campus"**.
5. **Move & See**: Both players see each other moving in realtime with college badges and smooth interpolation.
6. **Chat**: Type a message in the bottom-left chat from Emmanuel; Tobi sees it immediately.
7. **Social**: Walk Emmanuel close to Tobi -> press `[E]` -> Click **"Add Friend"**.
8. **Keke Ride**: Walk to the Keke Park (`[-18, 18]`), wait for the yellow Keke, press `[E]` to board (₦50 deducted), and ride together to COLFHEC or the Hostel.
9. **Food & Wallet**: Walk to **Mama Cass Buka** -> press `[E]` -> buy *Jollof Rice & Crispy Chicken (₦800)* -> check wallet balance and backpack inventory.
10. **1v1 PlayStation Showdown**: Walk to the **PS Room** (`[-20, -38]`) -> Player A creates match -> Player B joins -> play 3 rounds of penalty shootout!

---

## ☁️ Deployment

### Cloudflare Workers (Multiplayer Room)
1. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Deploy the Worker & Durable Object:
   ```bash
   npm run worker:deploy
   ```
3. Set `VITE_WS_URL=wss://<your-worker-subdomain>.workers.dev` in your frontend environment.

### Supabase Database
Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
