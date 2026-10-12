(() => {
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  let manual = false, vt = 0, vtBase = 0, dateBase = 0, n = 1e6, queue = [];
  performance.now = () => (manual ? vt : realNow());
  Date.now = () => (manual ? dateBase + (vt - vtBase) : realDateNow());
  window.requestAnimationFrame = (cb) => {
    if (!manual) return realRaf(cb);
    const id = ++n; queue.push({ id, cb }); return id;
  };
  window.cancelAnimationFrame = (id) => { queue = queue.filter((q) => q.id !== id); realCancel(id); };
  window.__vtEnable = () => { manual = true; vt = vtBase = realNow(); dateBase = realDateNow(); };
  window.__step = (ms = 1000 / 30) => {
    vt += ms; const q = queue; queue = [];
    for (const { cb } of q) { try { cb(vt); } catch (e) { console.error(e); } }
    return q.length;
  };
})();
