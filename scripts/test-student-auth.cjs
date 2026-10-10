const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const id = '00000000-0000-4000-8000-000000000010';
  let beta = false,
    profile = {
      id,
      username: 'FreshTester',
      college: 'COLENG',
      avatar_config: { shirtColor: '#15803d', skinColor: '#8d5524' },
      onboarding_completed: false,
    };
  let walletWrites = 0,
    signups = 0,
    logins = 0;
  const user = {
    id,
    email: 'test@example.invalid',
    aud: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { username: 'FreshTester', college: 'COLENG' },
    created_at: new Date().toISOString(),
  };
  const session = {
    access_token: 'fake.auth.signature',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
  await page.route('https://student-test.supabase.co/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let data = [];
    if (url.pathname.endsWith('/signup')) {
      signups++;
      data = session;
    }
    if (url.pathname.endsWith('/token')) {
      logins++;
      data = session;
    }
    if (url.pathname.endsWith('/user')) data = user;
    if (url.pathname.endsWith('/logout')) data = {};
    if (url.pathname.endsWith('/profiles')) {
      data = url.searchParams.has('username') ? null : profile;
    }
    if (url.pathname.endsWith('/ensure_student_journey'))
      data = [
        { beta_player: beta, draft: {}, orientation_steps: [], orientation_completed: false },
      ];
    if (/wallet/.test(url.pathname) && req.method() !== 'GET') walletWrites++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await page.goto('http://127.0.0.1:5178/');
  await page.getByPlaceholder('e.g. Emmanuel').fill('FreshTester');
  await page.getByPlaceholder('student@funaab.edu.ng').fill('test@example.invalid');
  await page.locator('input[type=password]').fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).waitFor();
  assert.equal(signups, 1);
  assert.equal(walletWrites, 0);
  await page.reload();
  await page.getByRole('button', { name: 'Begin', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  beta = true;
  profile = { ...profile, username: 'BetaTester' };
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByPlaceholder('student@funaab.edu.ng').fill('test@example.invalid');
  await page.locator('input[type=password]').fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Still you. More campus life.' }).waitFor();
  assert.equal(logins, 1);
  assert.equal(walletWrites, 0);
  assert.equal(await page.getByLabel('Display name').inputValue(), 'BetaTester');
  await browser.close();
  console.log(
    'Auth browser PASSED: signup → new onboarding, refresh session restoration, sign out, beta login → short completion, no auth wallet writes.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
