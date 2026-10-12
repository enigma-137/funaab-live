// In-page helpers installed after entering campus.
async function installHelpers(page) {
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('@react-three_fiber'));
    const fiber = await import(url);
    const root = [...fiber._roots.entries()].sort((a, b) => b[0].width * b[0].height - a[0].width * a[0].height)[0][1];
    const st = root.store.getState();
    window.__r3f = root.store;
    const gl = st.gl, orig = gl.render.bind(gl);
    window.__cam = null; // function(camera, t) for drone shots
    gl.render = (scene, cam) => { if (window.__cam) { window.__cam(cam); cam.updateMatrixWorld(); } return orig(scene, cam); };
    window.__mods = {
      game: (await import('/src/stores/gameStore.ts')).useGameStore,
      input: (await import('/src/stores/inputStore.ts')).useInputStore,
      hostel: (await import('/src/stores/hostelStore.ts')).useHostelStore,
      social: (await import('/src/stores/socialStore.ts')).useSocialStore,
    };
    // Drone helper: orbit around (cx,cz) at radius r, height h, angle a, looking at (lx,ly,lz)
    window.__drone = (o) => (cam) => {
      cam.position.set(o.x, o.y, o.z); cam.lookAt(o.lx, o.ly, o.lz);
      if (o.fov && cam.fov !== o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); }
    };
    // Cinematic mode: hide every HUD element that is not the 3D canvas (keeps in-world name tags).
    window.__cine = (on) => {
      let el = st.gl.domElement.parentElement.parentElement;
      while (el && el !== document.body) {
        for (const sib of el.parentElement.children) if (sib !== el && sib.tagName !== 'SCRIPT' && sib.tagName !== 'STYLE') sib.style.visibility = on ? 'hidden' : '';
        el = el.parentElement;
      }
    };
  });
}
module.exports = { installHelpers };
