// Shared harness: mocks Supabase + realtime so the real game client runs locally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ID = '00000000-0000-4000-8000-000000000001';
const profile = { id: ID, username: 'Emmanuel', college: 'COLENG',
  avatar_config: { shirtColor: '#15803d', skinColor: '#8d5524', topColor: '#15803d', bottomColor: '#1e293b', hairStyle: 'short' },
  onboarding_completed: true, course_id: 'FST', game_matric_number: 'FST/26/1001' };
const journey = { beta_player: false, draft: {}, orientation_steps: ['a','b','c','d','e'], orientation_completed: true, admission_story_completed: true };
async function launch({ width = 1920, height = 1080, peers = [] } = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route('https://student-test.supabase.co/**', async (route) => {
    const req = route.request(), url = new URL(req.url());
    let data = [];
    const p = url.pathname;
    if (p.includes('/auth/')) data = { user: { id: ID, email: 'test@example.invalid' } };
    if (p.endsWith('/profiles')) data = profile;
    if (p.endsWith('/ensure_student_journey') || p.endsWith('/student_journeys')) data = [journey];
    if (p.endsWith('/ensure_player_wallet')) data = { success: true, balance: 7500 };
    if (p.endsWith('/wallets')) data = { balance: 7500 };
    if (p.endsWith('/friends')) data = [];
    if (p.endsWith('/job_runs')) data = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await context.route('**/campus-summary', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ studentsOnline: 24, popular: [{ name: 'Car Park', count: 8 }, { name: 'COLFHEC', count: 6 }] }) }));
  const page = await context.newPage();
  const state = { socket: null, connectionId: '' };
  await page.routeWebSocket('**:8787/**', (ws) => {
    state.socket = ws;
    ws.onMessage((raw) => {
      const pk = JSON.parse(raw);
      if (pk.type === 'join') {
        state.connectionId = pk.player.connectionId;
        const players = {};
        for (const pl of peers) players[pl.connectionId] = pl;
        ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: pk.player.connectionId, players, kekes: {}, activeMatches: {} }));
      }
      if (pk.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: pk.t }));
    });
  });
  const session = { access_token: 'fake.test.signature', refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    expires_in: 3600, token_type: 'bearer', user: { id: ID, email: 'test@example.invalid', app_metadata: { provider: 'email' },
    user_metadata: { username: profile.username, college: profile.college }, aud: 'authenticated', created_at: new Date().toISOString() } };
  await context.addInitScript((s) => {
    localStorage.setItem('sb-student-test-auth-token', JSON.stringify(s));
    localStorage.setItem('funaab_mobile_tutorial_seen', 'true');
  }, session);
  page.setDefaultTimeout(300000); page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  return { browser, context, page, state };
}
async function enterCampus(page) {
  await page.goto('http://127.0.0.1:5178/', { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Enter Campus', exact: true }).click();
  await page.waitForFunction(async () => { const { useGameStore } = await import('/src/stores/gameStore.ts'); return useGameStore.getState().connectionStatus === 'connected'; });
}
module.exports = { launch, enterCampus, profile };
