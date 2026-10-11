const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(
  process.env.STUDENT_TEST_OUTPUT || "test-results/campus",
  "screenshots",
);
fs.mkdirSync(root, { recursive: true });
let lastPage;
let browser;

(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args:
      process.env.HOSTEL_TEST_GPU === "native"
        ? []
        : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const results = [];
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [430, 932],
    [1440, 1000],
  ].filter(
    ([w]) => !process.env.TEST_WIDTH || w === Number(process.env.TEST_WIDTH),
  )) {
    console.log("BROWSER START", width, height);
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 650,
      isMobile: width < 650,
    });
    let profile = {
      id: "00000000-0000-4000-8000-000000000001",
      username: "CampusTester",
      college: "COLFHEC",
      avatar_config: { shirtColor: "#15803d", skinColor: "#8d5524" },
      onboarding_completed: true,
      course_id: "FST",
      game_matric_number: "FST/26/1001",
    };
    let journey = {
      beta_player: false,
      draft: {},
      orientation_steps: [],
      orientation_completed: false,
      admission_story_completed: false,
    };
    let saves = 0,
      joined = 0,
      failSave = false;
    let wallet = 7777,
      inventory = [],
      debts = [],
      placements = [];
    let room = { owner_id: profile.id, privacy: "invite", tv_on: false };
    const requests = new Set();
    const errors = [];
    const page = await context.newPage();
    lastPage = page;
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("PAGE ERROR", e.message);
    });
    await context.route(
      "https://student-test.supabase.co/**",
      async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          body = req.postDataJSON();
        let data = [];
        if (url.pathname.includes("/auth/")) {
          data = { user: { id: profile.id, email: "test@example.invalid" } };
        }
        if (url.pathname.endsWith("/profiles")) {
          if (req.method() === "GET") data = profile;
          else data = profile;
        }
        if (url.pathname.endsWith("/ensure_student_journey")) data = [journey];
        if (url.pathname.endsWith("/student_journeys")) {
          if (req.method() === "PATCH") journey = { ...journey, ...body };
          data = [journey];
        }
        if (url.pathname.endsWith("/accept_game_admission")) {
          profile = {
            ...profile,
            course_id: body.p_course_id,
            game_matric_number: "FST/26/1001",
          };
          data = [profile];
        }
        if (url.pathname.endsWith("/complete_student_profile")) {
          if (failSave) {
            failSave = false;
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ message: "Temporary test save failure" }),
            });
          }
          saves++;
          profile = {
            ...profile,
            onboarding_completed: true,
            course_id: body.p_course_id,
            game_matric_number: "FST/26/1001",
            avatar_config: body.p_avatar,
          };
          data = [profile];
        }
        if (url.pathname.endsWith("/ensure_player_wallet"))
          data = { success: true, balance: wallet };
        if (url.pathname.endsWith("/wallets")) data = { balance: wallet };
        if (url.pathname.endsWith("/friends"))
          data = [
            {
              friend_id: "friend-1",
              status: "accepted",
              friend: {
                id: "friend-1",
                username: "BetaFriend",
                college: "COLENG",
              },
            },
          ];
        if (url.pathname.endsWith("/inventory")) data = inventory;
        if (url.pathname.endsWith("/game_debts")) data = debts;
        if (url.pathname.endsWith("/job_runs")) data = null;
        if (url.pathname.endsWith("/hostel_snapshot"))
          data = { room, placements, owner_name: profile.username };
        if (url.pathname.endsWith("/hostel_command")) {
          const d = body.p_data,
            a = body.p_action;
          if (!requests.has(body.p_request)) {
            requests.add(body.p_request);
            if (a === "purchase") {
              const price =
                d.item === "hostel_tv_basic"
                  ? 500
                  : d.item === "hostel_chair"
                    ? 150
                    : 300;
              if (d.credit)
                debts.push({
                  id: "debt1",
                  item_id: d.item,
                  amount: 330,
                  due_at: new Date(Date.now() + 172800000).toISOString(),
                  paid_at: null,
                });
              else wallet -= price;
              inventory.push({
                id: d.item,
                item_id: d.item,
                item_name: d.item,
                item_type: "hostel",
                quantity: 1,
              });
            }
            if (a === "place") {
              placements = placements.filter((p) => p.item_id !== d.item);
              if (d.anchor || d.x !== undefined)
                placements.push({
                  item_id: d.item,
                  owner_id: profile.id,
                  anchor: d.anchor,
                  rotation: d.rotation,
                  x: d.x,
                  y: d.y,
                  z: d.z,
                });
            }
            if (a === "pay") {
              const debt = debts.find((x) => x.id === d.debt);
              if (!debt.paid_at) {
                wallet -= debt.amount;
                debt.paid_at = new Date().toISOString();
              }
            }
            if (a === "tv") room.tv_on = !room.tv_on;
          }
          data = { success: true };
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      },
    );
    await context.route("**/campus-summary", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studentsOnline: 18,
          popular: [{ name: "Car Park", count: 6 }],
        }),
      }),
    );
    let connectionId = "",
      testSocket,
      bookingRequests = [];
    await page.routeWebSocket("**:8787/**", (ws) => {
      testSocket = ws;
      ws.onMessage((raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === "join") {
          joined++;
          connectionId = packet.player.connectionId;
          ws.send(
            JSON.stringify({
              type: "snapshot",
              yourConnectionId: packet.player.connectionId,
              players:
                packet.room === "world:funaab:library"
                  ? {
                      reader: {
                        id: "00000000-0000-4000-8000-000000000002",
                        connectionId: "reader",
                        username: "Amina",
                        college: "COLVET",
                        position: [1.8, 0, 7],
                        rotation: 0,
                        animation: "idle",
                        avatarConfig: {
                          shirtColor: "#b47c47",
                          skinColor: "#8d5524",
                        },
                      },
                    }
                  : {},
              kekes: {},
              activeMatches: {},
            }),
          );
        }
        if (packet.type === "keke_book") {
          bookingRequests.push(packet);
          ws.send(
            JSON.stringify({
              type: "action_result",
              requestId: packet.requestId,
              result: {
                kekeId: packet.kekeId,
                destinationId: packet.destinationId,
                fare: 60,
                balance: 7717,
              },
            }),
          );
        }
        if (packet.type === "ping")
          ws.send(JSON.stringify({ type: "pong", t: packet.t }));
      });
    });
    const session = {
      access_token: "fake.test.signature",
      refresh_token: "fake-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 86400,
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: profile.id,
        email: "test@example.invalid",
        app_metadata: { provider: "email" },
        user_metadata: { username: profile.username, college: profile.college },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };
    await context.addInitScript((session) => {
      // Keep software-rendered acceptance tests at a mobile-like 30 fps.
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        raf((t) => setTimeout(() => callback(performance.now()), 16));
      localStorage.setItem(
        "sb-student-test-auth-token",
        JSON.stringify(session),
      );
      localStorage.setItem("funaab_mobile_tutorial_seen", "true");
    }, session);
    page.setDefaultNavigationTimeout(60000);
    await page.goto("http://127.0.0.1:5180/", {
      waitUntil: "commit",
    });

    page.setDefaultTimeout(60000);
    await page
      .getByRole("button", { name: "Enter Campus", exact: true })
      .click();
    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      return useGameStore.getState().connectionStatus === "connected";
    });
    const act = async (f) => page.evaluate(f);
    const tap = async (locator) =>
      width < 650 ? locator.tap() : locator.click();

    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      return !!useGameStore.getState().playerRef?.current;
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const realNow = Date.now.bind(Date);
      const offset = Date.parse("2026-10-12T09:00:00Z") - realNow();
      Date.now = () => realNow() + offset;
    });
    await act(async () => {
      const { useHostelStore } = await import("/src/stores/hostelStore.ts");
      useHostelStore.setState({ teleport: [20, 0, 12] });
    });
    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      const s = useGameStore.getState();
      return (
        s.nearbyInteractable?.type === "library" &&
        Math.hypot(s.myPosition[0] - 20, s.myPosition[2] - 12) < 1
      );
    });
    await act(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      useGameStore.setState({ activeModal: "library" });
    });
    await tap(page.getByRole("button", { name: "Enter library", exact: true }));
    await page
      .getByRole("button", { name: "Leave library", exact: true })
      .waitFor();
    await page.waitForFunction(async () => {
      const { networkManager } =
        await import("/src/game/multiplayer/networkManager.ts");
      return networkManager.room === "world:funaab:library";
    });
    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      const s = useGameStore.getState();
      return (
        !!s.playerRef?.current &&
        Math.abs(s.myPosition[0]) < 1 &&
        Math.abs(s.myPosition[2] - 9) < 1
      );
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(root, `library-${width}.png`) });
    assert(
      await act(async () => {
        const { useGameStore } = await import("/src/stores/gameStore.ts");
        return !!useGameStore.getState().players.reader;
      }),
      "Library peer is present",
    );
    const before = await act(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      return useGameStore.getState().myPosition;
    });
    await page.keyboard.down("w");
    await page.waitForTimeout(1000);
    await page.keyboard.up("w");
    const after = await act(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      return useGameStore.getState().myPosition;
    });
    assert(
      Math.hypot(before[0] - after[0], before[2] - after[2]) > 1,
      "Can walk in the library",
    );
    await tap(page.getByRole("button", { name: "Leave library", exact: true }));
    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      const { useHostelStore } = await import("/src/stores/hostelStore.ts");
      return (
        useHostelStore.getState().roomId === "world:funaab:main" &&
        Math.abs(useGameStore.getState().myPosition[0] - 20) < 1
      );
    });
    await act(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      useGameStore.setState({ activeModal: "library" });
    });
    await tap(page.getByRole("button", { name: "Enter library", exact: true }));
    await page
      .getByRole("button", { name: "Leave library", exact: true })
      .waitFor();
    await page.waitForFunction(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      return !!useGameStore.getState().playerRef?.current;
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      Date.now = () => Date.parse("2026-10-12T16:00:00Z");
    });
    await page
      .getByRole("button", { name: "Leave library", exact: true })
      .waitFor({ state: "hidden" });
    await act(async () => {
      const { useGameStore } = await import("/src/stores/gameStore.ts");
      useGameStore.setState({ activeModal: "library" });
    });
    assert(
      await page
        .getByRole("button", { name: "Library closed", exact: true })
        .isDisabled(),
    );
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    console.log(
      "PASS library entry, movement, exit, closing and closed admission",
      width,
    );
    await context.close();
  }
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  try {
    if (lastPage)
      await lastPage.screenshot({
        path: path.join(root, "library-failure.png"),
        timeout: 10000,
      });
  } catch {}
  await browser?.close();
  process.exitCode = 1;
});
