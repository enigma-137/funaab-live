// Renders each gameplay shot as a JPEG sequence at a virtual 30 fps.
const fs = require('fs');
const { launch, enterCampus } = require('./harness.cjs');
const { installHelpers } = require('./lib.cjs');
const only = process.argv.slice(2);

const { peers } = require('./peers2.cjs');
const NIGHT = `window.__dn.setState({ night: 1 });`, DAY = `window.__dn.setState({ night: 0 });`;
// Each shot: setup (in-page, once), perFrame (in-page, called with t in [0,1]), frames, warmup.
const shots = {
  night_library: { frames: 120, cine: 'all', fog: 230, night: 1, perFrame: `(t) => {
    const a = L(1.05, 0.45, E(t)), r = L(52, 44, t);
    window.__cam = window.__drone({ x: 20 + Math.sin(a) * r, y: L(19, 15, t), z: 8 + Math.cos(a) * r, lx: 20, ly: 4, lz: 6, fov: 45 });
  }` },
  arena: { frames: 150, cine: 'all', night: 1, setup: `() => { M.hostel.setState({ teleport: [124, 0, -50] }); }`, perFrame: `(t) => {
    const a = L(-0.9, 0.5, E(t)), r = L(10.5, 8.5, t);
    window.__cam = window.__drone({ x: 130.5 + Math.sin(a) * r, y: L(5.5, 4.2, t), z: -45 + Math.cos(a) * r, lx: 130.5, ly: 1.2, lz: -45, fov: 55 });
  }` },
  keke: { frames: 120, cine: 'hud', warmup: 20, night: 0, setup: `async () => {
    const ks = await import('/src/config/kekeSimulation.ts');
    const me = M.game.getState().myConnectionId;
    const k = ks.createKeke(true); ks.bookRide(k, 'library', Date.now(), 'whatsnew');
    k.deadline = Date.now() - 1; k.passengers = [me]; k.targets = { [me]: 'library' };
    for (let i = 0; i < 60; i++) ks.tickKeke(k, Date.now() + i * 33, 1 / 30);
    window.__keke = { ks, k, me };
    M.input.getState().setCameraPitch(0.18);
  }`, perFrame: `(t) => {
    const { ks, k } = window.__keke;
    ks.tickKeke(k, Date.now(), 1 / 30);
    M.game.getState().setKekes({ [k.id]: JSON.parse(JSON.stringify(k)) });
    M.game.getState().setRidingKeke(true, k.id, 'library');
    // Chase-cam: stay a little behind and to the side of the keke's heading.
    M.input.getState().setCameraYaw(k.rotation + Math.PI + 0.55);
  }`, everyWarmup: true },
  col_a: { frames: 60, cine: 'all', fog: 230, night: 0, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(92, 98, t), y: L(22, 19, t), z: L(24, 18, t), lx: 128, ly: 3, lz: -8, fov: 45 });
  }` },
  col_b: { frames: 60, cine: 'all', fog: 230, night: 0, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(-66, -72, t), y: L(19, 17, t), z: L(88, 84, t), lx: -100, ly: 4, lz: 62, fov: 45 });
  }` },
  col_c: { frames: 60, cine: 'all', fog: 230, night: 0, perFrame: `(t) => {
    window.__cam = window.__drone({ x: L(-2, 4, t), y: L(17, 15, t), z: L(46, 42, t), lx: -30, ly: 3, lz: 18, fov: 45 });
  }` },
  farm: { frames: 135, cine: 'all', fog: 230, night: 0, perFrame: `(t) => {
    const g = M.game.getState();
    g.updatePlayer('peer-f4', { position: [L(118, 132, t), 0, 40], rotation: Math.PI / 2, animation: 'walk' });
    g.updatePlayer('peer-f2', { position: [127, 0, L(48, 42, t)], rotation: Math.PI, animation: 'walk' });
    window.__cam = window.__drone({ x: L(111, 115, E(t)), y: L(9, 7.5, t), z: L(57, 53, E(t)), lx: 126, ly: 0.5, lz: 39, fov: 45 });
  }` },
  courts: { frames: 120, cine: 'all', fog: 230, night: 0.55, perFrame: `(t) => {
    const g = M.game.getState();
    g.updatePlayer('peer-c1', { position: [L(-108, -102, t), 0, L(29, 32, t)], rotation: 1.2, animation: 'run' });
    g.updatePlayer('peer-c3', { position: [L(-95, -99, t), 0, L(34, 30, t)], rotation: -2.3, animation: 'run' });
    window.__cam = window.__drone({ x: L(-80, -86, E(t)), y: L(15, 12, t), z: L(52, 50, t), lx: -100, ly: 0, lz: 31, fov: 45 });
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
  await page.evaluate(async () => { const dn = (await import('/src/game/world/dayNight.ts')).useDayNight;
    // The game re-reads the real Lagos clock every 30 s; pin the look per shot instead.
    const set = dn.setState.bind(dn); dn.setState = () => {};
    window.__dn = { setState: set }; });
  await page.evaluate(() => window.__vtEnable());
  await page.waitForTimeout(1000); // let the pending real rAF hand the loop over to virtual time
  const cdp = await context.newCDPSession(page);
  for (const [name, s0] of Object.entries(shots)) {
    const s = process.env.QUICK ? { ...s0, frames: 3 } : s0;
    if (only.length && !only.includes(name)) continue;
    const dir = `${__dirname}/frames2/${name}`; fs.mkdirSync(dir, { recursive: true });
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
