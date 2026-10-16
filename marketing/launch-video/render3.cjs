// Renders each gameplay shot as a JPEG sequence at a virtual 30 fps.
const fs = require('fs');
const { launch, enterCampus } = require('./harness.cjs');
const { installHelpers } = require('./lib.cjs');
const only = process.argv.slice(2);

const { peers } = require('./peers3.cjs');
const ch = (x, z) => [62 + x, 0, -125 + z];
// Each shot: setup (in-page, once), perFrame (in-page, called with t in [0,1]), frames, warmup.
const shots = {
  car: { frames: 150, cine: 'all', warmup: 6, setup: `() => {
    M.car.setState({ fuel: { car_gwagon: 40 }, parked: { car: 'car_gwagon', position: [3, 0, 72], rotation: Math.PI }, driving: 'car_gwagon', view: 'outside' });
    M.input.getState().setCameraYaw(0.7); M.input.getState().setCameraPitch(0.12);
  }`, afterWarmup: `() => { M.input.setState({ joystick: [0, -1] }); }`,
    perFrame: `(t) => { M.input.getState().setCameraYaw(L(0.7, 0.2, E(t))); if (t > 0.97) M.input.setState({ joystick: [0, 0] }); }` },
  mosque: { frames: 120, cine: 'all', warmup: 40, setup: `() => {
    M.input.setState({ joystick: [0, 0] }); M.car.setState({ driving: null, parked: null });
    M.hostel.setState({ teleport: [-63, 0, -126 - 4.6 + 1.75] });
  }`, afterWarmup: `() => { M.game.getState().sitAtPosition([-63, 0, -126 - 4.6 + 1.75], Math.PI, { animation: 'pray' }); }`,
    perFrame: `(t) => { M.input.getState().setCameraYaw(L(-0.45, 0.35, E(t))); M.input.getState().setCameraPitch(L(0.42, 0.3, t)); }` },
  chapel: { frames: 120, cine: 'all', warmup: 40, setup: `() => {
    M.input.setState({ joystick: [0, 0] }); M.car.setState({ driving: null, parked: null });
    M.game.getState().standUp?.(); window.__dayShift = 2 * 86400000;
    M.hostel.setState({ teleport: ${JSON.stringify(ch(-2.3, 4.15))} });
  }`, afterWarmup: `() => { M.game.getState().sitAtPosition(${JSON.stringify(ch(-2.3, 4.15))}, Math.PI, { animation: 'sit' }); }`,
    perFrame: `(t) => { window.__cam = window.__drone({ x: 62 + L(-4, 4, E(t)), y: L(4.6, 4, t), z: -132.5, lx: 62, ly: 0.6, lz: -121, fov: 60 }); }` },
  estate: { frames: 135, cine: 'all', fog: 260, setup: `() => {
    M.game.getState().standUp?.(); window.__dayShift = 0;
    M.hostel.setState({ teleport: [6, 0, 70] });
    M.car.setState({ driving: null, parked: { car: 'car_lexus', position: [-11, 0, 130.6], rotation: Math.PI / 2 }, fuel: { car_lexus: 20 } });
  }`, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(40, 22, E(t)), y: L(30, 24, t), z: L(104, 108, E(t)), lx: 0, ly: 0, lz: 146, fov: 50 });
  }` },
  group: { frames: 105, cine: null, warmup: 10, small: true, setup: `async () => {
    const G = (await import('/src/stores/groupStore.ts')).useGroupStore; window.__G = G;
    const at = new Date().toISOString();
    window.__msg = (id, sender, college, body) => ({ id, kind: 'text', body, sender_id: 'peer-' + sender, sender, college, at });
    G.setState({ open: { id: 'g1', name: 'Aluta Squad 🔥', owner: 'peer-Tolu', members: ['Tolu', 'Chidi', 'Aisha', 'Bolu'].map((u) => ({ id: 'peer-' + u, username: u, college: 'COLENG' })),
      messages: [{ id: 1, kind: 'system', body: 'Tolu created the group', sender_id: null, sender: null, college: null, at }] } });
    M.game.getState().setActiveModal('group_chat');
    window.__fi = 0;
    window.__chat = { 6: ['Tolu', 'COLFHEC', 'Who dey Arena tonight? 🎉'], 30: ['Chidi', 'COLENG', 'Omo I go come after lecture'], 54: ['Aisha', 'COLVET', 'Mosque first, then I join una 🕌'], 78: ['Bolu', 'COLANIM', 'I fit give una lift for my car 🚗'] };
  }`, perFrame: `(t) => {
    const c = window.__chat[window.__fi++];
    if (c) { const o = window.__G.getState().open; window.__G.setState({ open: { ...o, messages: [...o.messages, window.__msg(o.messages.length + 1, ...c)] } }); }
  }` },
};

(async () => {
  const small = only.includes('group');
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
    const dir = `${__dirname}/frames3/${name}`; fs.mkdirSync(dir, { recursive: true });
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
      await page.evaluate(`window.__dn.setState({ night: ${s.night ?? 0} }); ${s.everyWarmup && frameFn ? frameFn + '(0);' : ''} window.__step()`);
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
