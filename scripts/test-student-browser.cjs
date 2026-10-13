const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(
  process.env.STUDENT_TEST_OUTPUT || 'test-results/student-journey',
  'screenshots',
);
fs.mkdirSync(root, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const results = [];
  for (const [width, height] of process.env.EXTENDED_ONLY
    ? [[360, 800]]
    : [
        [360, 800],
        [390, 844],
        [412, 915],
        [430, 932],
        [1440, 1000],
      ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 650,
      isMobile: width < 650,
    });
    let profile = {
      id: '00000000-0000-4000-8000-000000000001',
      username: 'CampusTester',
      college: 'COLFHEC',
      avatar_config: { shirtColor: '#15803d', skinColor: '#8d5524' },
      onboarding_completed: false,
      course_id: null,
      game_matric_number: null,
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
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await context.route('https://student-test.supabase.co/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        body = req.postDataJSON();
      let data = [];
      if (url.pathname.includes('/auth/')) {
        data = { user: { id: profile.id, email: 'test@example.invalid' } };
      }
      if (url.pathname.endsWith('/profiles')) {
        if (req.method() === 'GET') data = profile;
        else data = profile;
      }
      if (url.pathname.endsWith('/ensure_student_journey')) data = [journey];
      if (url.pathname.endsWith('/student_journeys')) {
        if (req.method() === 'PATCH') journey = { ...journey, ...body };
        data = [journey];
      }
      if (url.pathname.endsWith('/accept_game_admission')) {
        profile = { ...profile, course_id: body.p_course_id, game_matric_number: 'FST/26/1001' };
        data = [profile];
      }
      if (url.pathname.endsWith('/complete_student_profile')) {
        if (failSave) {
          failSave = false;
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Temporary test save failure' }),
          });
        }
        saves++;
        profile = {
          ...profile,
          onboarding_completed: true,
          course_id: body.p_course_id,
          game_matric_number: 'FST/26/1001',
          avatar_config: body.p_avatar,
        };
        data = [profile];
      }
      if (url.pathname.endsWith('/ensure_player_wallet')) data = { success: true, balance: 7777 };
      if (url.pathname.endsWith('/wallets')) data = { balance: 7777 };
      if (url.pathname.endsWith('/friends'))
        data = [
          {
            friend_id: 'friend-1',
            status: 'accepted',
            friend: { id: 'friend-1', username: 'BetaFriend', college: 'COLENG' },
          },
        ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    });
    await context.route('**/campus-summary', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ studentsOnline: 18, popular: [{ name: 'Car Park', count: 6 }] }),
      }),
    );
    await page.routeWebSocket('**:8787/**', (ws) => {
      ws.onMessage((raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === 'join') {
          joined++;
          ws.send(
            JSON.stringify({
              type: 'snapshot',
              yourConnectionId: packet.player.connectionId,
              players: {},
              kekes: {},
              activeMatches: {},
            }),
          );
        }
        if (packet.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: packet.t }));
      });
    });
    const session = {
      access_token: 'fake.test.signature',
      refresh_token: 'fake-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: profile.id,
        email: 'test@example.invalid',
        app_metadata: { provider: 'email' },
        user_metadata: { username: profile.username, college: profile.college },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };
    await context.addInitScript((session) => {
      localStorage.setItem('sb-student-test-auth-token', JSON.stringify(session));
      localStorage.setItem('funaab_mobile_tutorial_seen', 'true');
    }, session);
    await page.goto('http://127.0.0.1:5178/');
    const fit = async (name) => {
      await page.waitForTimeout(100);
      assert(
        await page.evaluate(
          () => document.querySelector('.student-entry').scrollWidth <= innerWidth + 1,
        ),
        `${name} overflow at ${width}`,
      );
    };
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await fit('profile');
    await page.getByLabel('Preferred course').selectOption('FST');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await fit('UTME');
    assert.equal(joined, 0, 'No multiplayer before entering');
    await page.reload();
    await page.getByRole('heading', { name: 'Game UTME result.' }).waitFor();
    await page.getByRole('button', { name: 'Try the campus screening' }).click();
    await page.getByLabel('Use the footpath', { exact: true }).check();
    await page.getByLabel('Keep it private', { exact: true }).check();
    await page.getByLabel('A Keke ride', { exact: true }).check();
    await page.getByRole('button', { name: 'See my game offer' }).click();
    await fit('admission');
    await page.screenshot({ path: path.join(root, `admission-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Accept Admission' }).click();
    await page.getByRole('button', { name: 'Create my student' }).click();
    await page.getByLabel('Body presentation').selectOption('feminine');

    await page.screenshot({ path: path.join(root, `avatar-before-${width}.png`), fullPage: true });
    await page.locator('select').nth(1).selectOption('braids');
    await page.getByRole('button', { name: 'Soft', exact: true }).click();
    await fit('avatar');
    await page.screenshot({ path: path.join(root, `avatar-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Save my student' }).click();
    await page.getByRole('heading', { name: "You're in." }).waitFor();
    assert.equal(saves, 1);
    assert.equal(profile.avatar_config.hairstyle, 'braids');
    await page.reload();
    await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
    await fit('returning');
    assert(await page.getByText('18 students online').isVisible());
    await page.screenshot({ path: path.join(root, `returning-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Enter Campus', exact: true }).click();
    await page.getByRole('button', { name: 'Open campus phone' }).waitFor();
    await page.waitForTimeout(500);
    assert(joined >= 1, 'Campus joins multiplayer');
    await page.getByRole('button', { name: 'Open campus phone' }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Avatar' }).click();
    await page.locator('select').nth(1).selectOption('bun');
    await page.getByRole('button', { name: 'Save Avatar', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Avatar' }).waitFor();
    assert.equal(profile.avatar_config.hairstyle, 'bun');
    if (process.env.EXTENDED_ONLY) {
      profile = {
        ...profile,
        onboarding_completed: false,
        course_id: null,
        game_matric_number: null,
      };
      journey = { ...journey, beta_player: true, draft: {} };
      await page.reload();
      await page.getByRole('heading', { name: 'Still you. More campus life.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Submit Application' }).count(), 0);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByText('Game matric: FST/26/1001', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Create my student' }).click();
      failSave = true;
      await page.getByRole('button', { name: 'Save my student' }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(profile.onboarding_completed, false);
      await page.getByRole('button', { name: 'Save my student' }).click();
      await page.getByRole('heading', { name: "You're in." }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: /Welcome back/ }).waitFor();
      assert.equal(profile.username, 'CampusTester');
      // Virtual-keyboard sized viewport remains scrollable; bottom actions stay reachable.
      await page.setViewportSize({ width: 360, height: 420 });
      await page.getByRole('button', { name: 'avatar', exact: true }).click();
      await page.getByRole('button', { name: 'Save Avatar', exact: true }).click();
      await page.getByRole('heading', { name: 'Your student card.' }).waitFor();
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ width, height, passed: true, joined, saves });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(
      path.dirname(root),
      process.env.EXTENDED_ONLY ? 'browser-extended-results.json' : 'browser-results.json',
    ),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
