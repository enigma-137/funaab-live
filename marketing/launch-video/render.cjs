// Renders each gameplay shot as a JPEG sequence at a virtual 30 fps.
const fs = require('fs');
const { launch, enterCampus } = require('./harness.cjs');
const { installHelpers } = require('./lib.cjs');
const only = process.argv.slice(2);

const peer = (id, username, college, position, avatarConfig, animation = 'idle', rotation = 0) => ({
  id: 'peer-' + id, connectionId: 'peer-' + id, username, college, position, rotation, animation,
  avatarConfig: { shirtColor: avatarConfig.topColor, skinColor: avatarConfig.skinTone, ...avatarConfig }, lastUpdated: Date.now(),
});
const peers = [
  peer('tolu', 'Tolu', 'COLFHEC', [22.8, 0, 10.8], { bodyType: 'feminine', skinTone: '#ad7147', hairstyle: 'braids', topStyle: 'blouse', topColor: '#f59e0b', bottomStyle: 'skirt', bottomColor: '#1e3a8a' }, 'wave', Math.PI * 0.8),
  peer('aisha', 'Aisha', 'COLVET', [17.6, 0, 12.2], { bodyType: 'feminine', skinTone: '#663c28', hairstyle: 'bun', topStyle: 't-shirt', topColor: '#db2777', bottomStyle: 'jeans', bottomColor: '#27364a' }, 'cheer', Math.PI * -0.7),
  peer('chidi', 'Chidi', 'COLENG', [6, 0, 14], { bodyType: 'masculine', skinTone: '#8d5524', hairstyle: 'fade', topStyle: 'hoodie', topColor: '#7c3aed', bottomStyle: 'joggers', bottomColor: '#111827' }, 'walk', Math.PI / 2),
  peer('bolu', 'Bolu', 'COLANIM', [27, 0, 9], { bodyType: 'masculine', skinTone: '#3d251e', hairstyle: 'short-afro', topStyle: 'polo', topColor: '#0ea5e9', bottomStyle: 'trousers', bottomColor: '#374151' }, 'walk', 0),
  peer('zainab', 'Zainab', 'COLPLANT', [19.6, 0, 9.4], { bodyType: 'feminine', skinTone: '#c68c63', hairstyle: 'natural-puff', topStyle: 'shirt', topColor: '#ffffff', bottomStyle: 'trousers', bottomColor: '#065f46' }, 'idle', Math.PI * 1.2),
  peer('kunle', 'Kunle', 'COLERM', [-63, 0, 39.5], { bodyType: 'masculine', skinTone: '#8d5524', hairstyle: 'low-cut', topStyle: 't-shirt', topColor: '#dc2626', bottomStyle: 'jeans', bottomColor: '#1f2937' }, 'idle', Math.PI),
  peer('ada', 'Ada', 'COLBIOS', [-59, 0, 40], { bodyType: 'feminine', skinTone: '#ad7147', hairstyle: 'short-twists', topStyle: 'hoodie', topColor: '#16a34a', bottomStyle: 'jeans', bottomColor: '#312e81' }, 'wave', Math.PI * 1.15),
];

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// Each shot: setup (in-page, once), perFrame (in-page, called with t in [0,1]), frames, warmup.
const shots = {
  drone_library: { frames: 150, cine: 'all', fog: 230, perFrame: `(t) => {
    const a = L(1.0, 0.35, E(t)), r = L(54, 44, t), h = L(21, 15, t);
    window.__cam = window.__drone({ x: 20 + Math.sin(a) * r, y: h, z: 6 + Math.cos(a) * r, lx: 20, ly: 4, lz: 6, fov: 45 });
  }` },
  walk_gate: { frames: 120, cine: 'hud', warmup: 25, setup: `() => {
    M.hostel.setState({ teleport: [7, 0, 76] }); M.input.getState().setCameraPitch(0.18);
  }`, afterWarmup: `() => { M.input.getState().setTargetDestination([7, 0, 30]); }`,
    perFrame: `(t) => { M.input.getState().setCameraYaw(L(0.55, 0.1, E(t))); }` },
  drone_coleng: { frames: 105, cine: 'all', fog: 230, perFrame: `(t) => {
    const a = L(0.25, 0.85, E(t)), r = 56, h = L(24, 18, t);
    window.__cam = window.__drone({ x: 80 + Math.sin(a) * r, y: h, z: -62 + Math.cos(a) * r, lx: 80, ly: 5, lz: -62, fov: 45 });
  }` },
  students: { frames: 165, cine: null, warmup: 30, setup: `() => {
    M.hostel.setState({ teleport: [21.5, 0, 15.2] }); M.input.getState().setCameraYaw(0.6); M.input.getState().setCameraPitch(0.22);
  }`, afterWarmup: `() => { M.input.getState().setTargetDestination([20.4, 0, 12.6]); window.__chatAt = { 8: ['peer-tolu','Tolu','COLFHEC','Who dey go CLT for 10am? 📚'], 50: ['peer-chidi','Chidi','COLENG','Omo, COLENG lab don finish me today 😂'], 95: ['peer-aisha','Aisha','COLVET','Suya after class? Mai Suya don open 🍢'], 135: ['peer-zainab','Zainab','COLPLANT','I dey library, come join us!'] }; window.__fi = 0; }`,
    perFrame: `(t) => {
      const g = M.game.getState();
      g.updatePlayer('peer-chidi', { position: [L(3, 15.5, t), 0, 12], rotation: Math.PI / 2, animation: 'walk' });
      g.updatePlayer('peer-bolu', { position: [L(23, 18.5, t), 0, 14.6], rotation: -Math.PI / 2, animation: 'walk' });
      const c = window.__chatAt[window.__fi++];
      if (c) M.social.getState().addMessage({ id: 'm' + window.__fi, senderId: c[0], senderName: c[1], college: c[2], text: c[3], timestamp: Date.now(), position: [20, 0, 18] });
    }` },
  lawn: { frames: 120, cine: null, warmup: 24, setup: `async () => {
    // Stage the gag: put the player on a lawn tile ~7 m from the nearest patrolling officer.
    // Officer positions only reach the store for ids it already knows; seed them from the patrol routes.
    const world = (await import('/src/config/campusWorld.ts')).default;
    M.game.getState().setSecurityOfficers(Object.fromEntries(world.securityRoutes.map((r) => [r.id, { id: r.id, name: r.name, position: r.points[0] }])));
    for (let i = 0; i < 5; i++) window.__step();
    const { classifyTerrain } = await import('/src/game/rules/lawnSecuritySystem.ts');
    const offs = Object.values(M.game.getState().securityOfficers || {});
    if (!offs.length) throw new Error('no officers; keys=' + Object.keys(M.game.getState()).filter(k => /secur/i.test(k)) + ' steps=' + window.__step());
    const o = offs.sort((a, b) => Math.hypot(a.position[0] - 20, a.position[2] - 20) - Math.hypot(b.position[0] - 20, b.position[2] - 20))[0];
    let best = null;
    for (let r = 6; r <= 9 && !best; r += 1) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, x = o.position[0] + Math.sin(a) * r, z = o.position[2] + Math.cos(a) * r;
      if (classifyTerrain(x, z).restricted && classifyTerrain(x + Math.sin(a) * 3, z + Math.cos(a) * 3).restricted) { best = { x, z, a }; break; }
    }
    window.__lawn = { o: o.position, p: best };
    M.hostel.setState({ teleport: [best.x, 0, best.z] });
    // Camera behind the player, looking back toward the officer, offset so both are in frame.
    M.input.getState().setCameraYaw(best.a + 0.45); M.input.getState().setCameraPitch(0.12);
  }`, afterWarmup: `() => {
    const { p } = window.__lawn; M.input.getState().setTargetDestination([p.x + Math.cos(p.a) * 2.5, 0, p.z - Math.sin(p.a) * 2.5]);
  }` },
  keke: { frames: 165, cine: null, warmup: 20, setup: `async () => {
    const ks = await import('/src/config/kekeSimulation.ts');
    const me = M.game.getState().myConnectionId;
    const k = ks.createKeke(true); ks.bookRide(k, 'library', Date.now(), 'launch');
    k.deadline = Date.now() - 1; k.passengers = [me]; k.targets = { [me]: 'library' };
    window.__keke = { ks, k, me };
    M.input.getState().setCameraYaw(Math.PI * 0.75); M.input.getState().setCameraPitch(0.25);
  }`, perFrame: `(t) => {
    const { ks, k, me } = window.__keke;
    ks.tickKeke(k, Date.now(), 1 / 30);
    M.game.getState().setKekes({ [k.id]: JSON.parse(JSON.stringify(k)) });
    M.game.getState().setRidingKeke(true, k.id, 'library');
  }`, everyWarmup: true },
  food: { frames: 120, cine: 'all', fog: 200, setup: `() => { M.hostel.setState({ teleport: [-61, 0, 41.5] }); }`, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(-48, -52, E(t)), y: L(6.5, 5, t), z: L(52, 47, E(t)), lx: -63, ly: 1.6, lz: 37, fov: 45 });
  }` },
  map: { frames: 75, cine: null, warmup: 10, setup: `() => { M.game.getState().setActiveModal('campus_map'); }` },
  finale: { frames: 165, cine: 'all', fog: 300, setup: `() => { M.game.getState().setActiveModal(null); }`, perFrame: `(t) => {
    const e = E(t);
    window.__cam = window.__drone({ x: L(14, 0, e), y: L(8, 48, e), z: L(104, 150, e), lx: 0, ly: L(4, 0, e), lz: L(70, 20, e), fov: 50 });
  }` },
};

(async () => {
  const { browser, context, page } = await launch({ width: 1920, height: 1080, peers });
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
  await page.evaluate(() => window.__vtEnable());
  await page.waitForTimeout(1000); // let the pending real rAF hand the loop over to virtual time
  const cdp = await context.newCDPSession(page);
  for (const [name, s0] of Object.entries(shots)) {
    const s = process.env.QUICK ? { ...s0, frames: 3 } : s0;
    if (only.length && !only.includes(name)) continue;
    const dir = `${__dirname}/frames/${name}`; fs.mkdirSync(dir, { recursive: true });
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
      await page.evaluate(`${s.everyWarmup && frameFn ? frameFn + '(0);' : ''} window.__step()`);
    }
    if (s.afterWarmup) await page.evaluate(`(${s.afterWarmup})()`);
    const t0 = Date.now();
    for (let i = 0; i < s.frames; i++) {
      const t = i / (s.frames - 1);
      // Name tags are re-shown by React each render; re-hide for free-camera shots.
      await page.evaluate(`${frameFn ? frameFn + '(' + t + ');' : ''} window.__step(); window.__applyCine();`);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      fs.writeFileSync(`${dir}/${String(i).padStart(4, '0')}.jpg`, Buffer.from(data, 'base64'));
    }
    console.log(name, 'done', ((Date.now() - t0) / s.frames).toFixed(0), 'ms/frame');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
