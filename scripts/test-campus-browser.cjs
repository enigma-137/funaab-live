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

(async () => {
  const browser = await chromium.launch({
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
    let connectionId='',testSocket,bookingRequests=[];
    await page.routeWebSocket("**:8787/**", (ws) => {
      testSocket=ws;
      ws.onMessage((raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === "join") {
          joined++;connectionId=packet.player.connectionId;
          ws.send(
            JSON.stringify({
              type: "snapshot",
              yourConnectionId: packet.player.connectionId,
              players: {},
              kekes: {},
              activeMatches: {},
            }),
          );
        }
        if(packet.type==='keke_book'){
          bookingRequests.push(packet);
          ws.send(JSON.stringify({type:'action_result',requestId:packet.requestId,result:{kekeId:packet.kekeId,destinationId:packet.destinationId,fare:60,balance:7717}}));
        }
        if (packet.type === "ping")
          ws.send(JSON.stringify({ type: "pong", t: packet.t }));
      });
    });
    const session = {
      access_token: "fake.test.signature",
      refresh_token: "fake-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
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
    page.setDefaultNavigationTimeout(300000);
    await page.goto("http://127.0.0.1:5178/", {
      waitUntil: "commit",
    });

    page.setDefaultTimeout(300000);
    await page.getByRole('button',{name:'Enter Campus',exact:true}).click();
    await page.waitForFunction(async()=>{const {useGameStore}=await import('/src/stores/gameStore.ts');return useGameStore.getState().connectionStatus==='connected';});
    const act=async(f)=>page.evaluate(f);
    const tap=async(locator)=>width<650?locator.tap():locator.click();
    await act(async()=>{
      const {useGameStore}=await import('/src/stores/gameStore.ts');const {useHostelStore}=await import('/src/stores/hostelStore.ts');const {createKeke}=await import('/src/config/kekeSimulation.ts');
      useGameStore.setState({kekes:{'keke-1':createKeke(false),'keke-carpark':createKeke(true)}});
      const {CAR_PARK_BAY}=await import('/src/config/campusLocations.ts');useHostelStore.setState({teleport:[CAR_PARK_BAY[0]+3,0,CAR_PARK_BAY[2]]});
    });
    await page.waitForFunction(async()=>{const {useGameStore}=await import('/src/stores/gameStore.ts');return useGameStore.getState().nearbyInteractable?.type==='keke_stop';});
    await tap(page.getByRole('button',{name:width<650?'Keke':'Book Ride',exact:true}));
    const sheet=page.getByRole('dialog',{name:'Campus Keke booking'});await sheet.waitFor();
    for(const name of ['COLVET','COLANIM','COLPLANT','COLERM','COLCOMS','Library'])assert(await sheet.getByRole('button').filter({hasText:name}).count()>0,name);
    const rect=await sheet.boundingBox();assert(rect.width<=width-20);assert(rect.height<=height*.68);
    await page.screenshot({path:path.join(root,`campus-${width}-booking.png`)});
    await tap(sheet.getByRole('button',{name:'Book ride',exact:true}));await sheet.waitFor({state:'hidden'});assert.equal(bookingRequests.length,1);assert.equal(bookingRequests[0].destinationId,'library');assert(!('fare' in bookingRequests[0]));
    const riding=await act(async()=>{const {createKeke,bookRide}=await import('/src/config/kekeSimulation.ts');const {useGameStore}=await import('/src/stores/gameStore.ts');const k=createKeke(true);bookRide(k,'library',Date.now(),'test');k.passengers=[useGameStore.getState().myConnectionId,'peer'];k.targets={[useGameStore.getState().myConnectionId]:'library'};return k;});
    testSocket.send(JSON.stringify({type:'players_batch',updates:{},kekes:{'keke-carpark':riding}}));
    await page.waitForFunction(async()=>{const {useGameStore}=await import('/src/stores/gameStore.ts');return useGameStore.getState().isRidingKeke;});
    await page.waitForTimeout(1200);
    const transit=page.getByText('Campus Keke',{exact:true});const transitBox=await transit.boundingBox();const phoneBox=await page.getByRole('button',{name:'Open campus phone'}).boundingBox();
    assert(transitBox&&phoneBox);assert(transitBox.x+transitBox.width<=phoneBox.x || transitBox.y>=phoneBox.y+phoneBox.height,'Transit must not overlap phone');
    assert.equal(await page.getByText(/Welcome to campus/).count(),0,'Orientation is hidden during a ride');
    await page.screenshot({path:path.join(root,`campus-${width}-riding.png`)});
    testSocket.send(JSON.stringify({type:'keke_dropoff',position:[3.2,0,12]}));
    await act(async()=>{const {useHostelStore}=await import('/src/stores/hostelStore.ts');useHostelStore.setState({teleport:[20,0,12]});});
    await page.waitForFunction(async()=>{const {useGameStore}=await import('/src/stores/gameStore.ts');return useGameStore.getState().nearbyInteractable?.type==='library';});
    await tap(page.getByRole('button',{name:width<650?'Library':'Visit Library lobby',exact:true}));
    await page.getByRole('dialog',{name:'Library',exact:true}).waitFor();await tap(page.getByRole('button',{name:'Visit lobby',exact:true}));
    await page.screenshot({path:path.join(root,`campus-${width}-library.png`)});
    await act(async()=>{const {useHostelStore}=await import('/src/stores/hostelStore.ts');await useHostelStore.getState().travel('hostel');});
    await page.getByRole('button',{name:'Return to campus',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Go Campus',exact:true}).count(),0);
    await page.screenshot({path:path.join(root,`campus-${width}-hostel.png`)});
    await tap(page.getByRole('button',{name:'Return to campus',exact:true}));
    await page.waitForFunction(async()=>{const {useHostelStore}=await import('/src/stores/hostelStore.ts');return useHostelStore.getState().roomId==='world:funaab:main';});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);results.push({width,height,passed:true});console.log('CAMPUS BROWSER PASSED',width);
    await context.close();
  }
  await browser.close();fs.writeFileSync(path.join(root,'../results.json'),JSON.stringify(results,null,2));
})().catch(async e=>{console.error(e);try{await lastPage?.screenshot({path:path.join(root,'failure.png')});}catch{}process.exit(1);});
