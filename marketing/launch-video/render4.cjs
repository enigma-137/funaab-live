// Renders each gameplay shot as a JPEG sequence at a virtual 30 fps.
const fs = require('fs');
const { launch, enterCampus } = require('./harness.cjs');
const { installHelpers } = require('./lib.cjs');
const only = process.argv.slice(2);

const { peers } = require('./peers4.cjs');
// Lagos clock shift so the gym is open (17:30 Lagos today).
const GYM_SHIFT = `(() => { const now = Date.now() - window.__dayShift, lagos = new Date(now + 3600000); const t = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate(), 17, 30) - 3600000; return t - now; })()`;
// Autopilot: steer the car toward a point a little ahead on the race line.
const AUTOPILOT = `(() => {
  const { pointAlong, projectOnto, RACE } = window.__race; const g = M.game.getState();
  const [x, , z] = g.myPosition, h = g.myRotation;
  const along = projectOnto(RACE.track, x, z).along; const p = pointAlong(RACE.track, along + 9);
  const want = Math.atan2(p.x - x, p.z - z); let d = want - h; d = Math.atan2(Math.sin(d), Math.cos(d));
  M.input.setState({ joystick: [Math.max(-1, Math.min(1, -d * 2.2)), Math.abs(d) > 0.6 ? -0.55 : -1] });
})()`;
const shots = {
  race: { frames: 165, cine: 'all', warmup: 70, setup: `async () => {
    window.__race = await import('/src/config/carRace.ts');
    const R = (await import('/src/stores/raceStore.ts')).useRaceStore; window.__R = R;
    const s = window.__race.gridSpot(0);
    M.car.setState({ fuel: { car_picanto: 40, car_gwagon: 40 }, parked: { car: 'car_gwagon', position: [s.x, 0, s.z], rotation: s.heading }, driving: 'car_gwagon', view: 'outside' });
    for (let i = 0; i < 4; i++) window.__step();
    R.getState().start();
    M.input.getState().setCameraYaw(Math.PI * 0.85); M.input.getState().setCameraPitch(0.14);
  }`, perFrame: `(t) => { if (window.__R.getState().status === 'racing') ${AUTOPILOT}; M.input.getState().setCameraYaw(M.game.getState().myRotation + Math.PI + L(0.5, 0.25, t)); }`,
    warmFrame: `() => { if (window.__R.getState().status === 'racing') ${AUTOPILOT}; M.input.getState().setCameraYaw(M.game.getState().myRotation + Math.PI + 0.5); }` },
  gym: { frames: 135, cine: 'all', warmup: 40, setup: `() => {
    M.input.setState({ joystick: [0, 0] }); window.__R?.getState().quit(); M.car.setState({ driving: null, parked: null });
    window.__dayShift = ${GYM_SHIFT};
    M.hostel.setState({ teleport: [128 - 9.4, 0, -78 + 7.4] });
  }`, perFrame: `(t) => { window.__cam = window.__drone({ x: 128 + L(-6.8, -5.6, E(t)), y: L(4.1, 3.6, t), z: -78 + L(5.4, 2.8, E(t)), lx: 128 + 2, ly: 0.9, lz: -78 - 1, fov: 62 }); }` },
  plaza: { frames: 165, cine: 'all', fog: 260, setup: `() => { window.__dayShift = 0; M.hostel.setState({ teleport: [6, 0, 50] }); }`, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(-13, -14, E(t)), y: L(5.5, 9, E(t)), z: L(53, 44, E(t)), lx: L(-27, -2, E(t)), ly: L(3.6, 3.5, t), lz: L(66, 72, E(t)), fov: 50 });
  }` },
  transport: { frames: 135, cine: 'all', fog: 240, warmup: 10, setup: `async () => {
    const ks = await import('/src/config/kekeSimulation.ts'); window.__ks = ks;
    const kor = ks.createKorope(); kor.phase = 'MOVING'; kor.isStopped = false;
    const kk = ks.createKeke(false); kk.phase = 'MOVING'; kk.isStopped = false;
    window.__tr = { kor, kk };
    for (let i = 0; i < 40; i++) { ks.tickKeke(kor, Date.now() + i * 33, 1 / 30); }
    for (let i = 0; i < 400; i++) { ks.tickKeke(kk, Date.now() + i * 33, 1 / 30); }
  }`, perFrame: `(t) => {
    const { kor, kk } = window.__tr, ks = window.__ks;
    for (const v of [kor, kk]) { if (v.phase === 'BOARDING') { v.phase = 'MOVING'; v.isStopped = false; } ks.tickKeke(v, Date.now(), 1 / 30); }
    M.game.getState().setKekes({ [kor.id]: JSON.parse(JSON.stringify(kor)), [kk.id]: JSON.parse(JSON.stringify(kk)) });
    const [x, , z] = kor.position, h = kor.rotation;
    window.__cam = window.__drone({ x: x - Math.sin(h) * 9 + Math.cos(h) * 6, y: 5.5, z: z - Math.cos(h) * 9 - Math.sin(h) * 6, lx: x + Math.sin(h) * 2, ly: 1.2, lz: z + Math.cos(h) * 2, fov: 50 });
  }`, everyWarmup: true },
  kitchen: { frames: 150, cine: 'all', warmup: 60, setup: `async () => {
    M.game.getState().setKekes({});
    await M.hostel.getState().travel('room');
  }`, afterWarmup: `() => { M.hostel.setState({ cooking: { item: 'hostel_food_rice', until: Date.now() + 2600 } }); window.__fi = 0; }`,
    perFrame: `(t) => {
      const f = window.__fi++, s = M.hostel.getState().snapshot;
      if (f < 75) { if (!M.hostel.getState().cooking) M.hostel.setState({ cooking: { item: 'hostel_food_rice', until: Date.now() + 5000 } }); }
      else { if (M.hostel.getState().cooking) M.hostel.setState({ cooking: null });
        if (s && s.room.served_food !== 'hostel_food_rice') M.hostel.setState({ snapshot: { ...s, room: { ...s.room, served_food: 'hostel_food_rice', served_drink: 'hostel_food_water' } } }); }
      window.__cam = window.__drone({ x: L(-1.9, -1.4, E(t)), y: L(2.5, 2.2, t), z: L(1.0, 0.4, E(t)), lx: L(1.8, 1.0, E(t)), ly: 0.6, lz: L(-2.3, -1.0, E(t)), fov: 58 });
    }` },
};

(async () => {
  const small = false;
  const { browser, context, page } = await launch(small ? { width: 960, height: 540, scale: 2, peers } : { width: 1920, height: 1080, peers });
  await context.addInitScript({ path: __dirname + '/vtime.js' });
  await enterCampus(page);
  await page.waitForTimeout(12000);
  await installHelpers(page);
  await page.evaluate(() => {
    window.M = window.__mods; window.L = (a, b, t) => a + (b - a) * t; window.E = (t) => t * t * (3 - 2 * t);
    const m = window.M;
    // Dismiss onboarding/activity toasts for a cleaner frame.
    m.game.setState?.({ activityFeed: [] });
    window.__baseFog = window.__r3f.getState().scene.fog?.far;
  });
  await page.evaluate(async () => { const dn = (await import('/src/game/world/dayNight.ts')).useDayNight;
    // The game re-reads the real Lagos clock every 30 s; pin the look per shot instead.
    const set = dn.setState.bind(dn); dn.setState = () => {};
    window.__dn = { setState: set };
    window.__mods.car = (await import('/src/stores/carStore.ts')).useCarStore; });
  await page.evaluate(() => window.__vtEnable());
  await page.waitForTimeout(1000); // let the pending real rAF hand the loop over to virtual time
  const cdp = await context.newCDPSession(page);
  for (const [name, s0] of Object.entries(shots)) {
    const s = process.env.QUICK ? { ...s0, frames: 3 } : s0;
    if (only.length && !only.includes(name)) continue;
    const dir = `${__dirname}/frames4/${name}`; fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(({ cine, fog }) => {
      window.__cam = null; window.__mode = cine;
      window.__applyCine = () => {
        const canvas = window.__r3f.getState().gl.domElement, layer = canvas.parentElement, grab = layer.parentElement;
        window.__cine(!!window.__mode);
        // 'all' also hides in-world name tags (drei Html), which drift under a free camera.
        for (const el of grab.children) if (el !== layer) el.style.visibility = window.__mode === 'all' ? 'hidden' : '';
      };
      window.__applyCine();
      const scene = window.__r3f.getState().scene; if (scene.fog) scene.fog.far = fog || window.__baseFog;
    }, { cine: s.cine, fog: s.fog });
    if (s.setup) await page.evaluate(`(${s.setup})()`);
    const frameFn = s.perFrame ? `(${s.perFrame})` : null;
    for (let i = 0; i < (s.warmup ?? 10); i++) {
      await page.evaluate(`window.__dn.setState({ night: ${s.night ?? 0} }); ${s.everyWarmup && frameFn ? frameFn + '(0);' : ''}${s.warmFrame ? '(' + s.warmFrame + ')();' : ''} window.__step()`);
    }
    if (s.afterWarmup) await page.evaluate(`(${s.afterWarmup})()`);
    const t0 = Date.now();
    for (let i = 0; i < s.frames; i++) {
      const t = i / (s.frames - 1);
      // Name tags are re-shown by React each render; re-hide for free-camera shots.
      await page.evaluate(`window.__dn.setState({ night: ${s.night ?? 0} }); ${frameFn ? frameFn + '(' + t + ');' : ''} window.__step(); window.__applyCine();`);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      fs.writeFileSync(`${dir}/${String(i).padStart(4, '0')}.jpg`, Buffer.from(data, 'base64'));
    }
    console.log(name, 'done', ((Date.now() - t0) / s.frames).toFixed(0), 'ms/frame');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
