const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(
  process.env.STUDENT_TEST_OUTPUT || 'test-results/hostel',
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
  for (const [width,height] of [[360,800],[1440,1000]]) {
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
      onboarding_completed: true,
      course_id: 'FST',
      game_matric_number: 'FST/26/1001',
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
    let wallet=7777,inventory=[],debts=[],placements=[];
    let room={owner_id:profile.id,privacy:'invite',tv_on:false};
    const requests=new Set();
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
      if (url.pathname.endsWith('/ensure_player_wallet')) data = { success: true, balance: wallet };
      if (url.pathname.endsWith('/wallets')) data = { balance: wallet };
      if (url.pathname.endsWith('/friends'))
        data = [
          {
            friend_id: 'friend-1',
            status: 'accepted',
            friend: { id: 'friend-1', username: 'BetaFriend', college: 'COLENG' },
          },
        ];
      if(url.pathname.endsWith('/inventory'))data=inventory;
      if(url.pathname.endsWith('/game_debts'))data=debts;
      if(url.pathname.endsWith('/job_runs'))data=null;
      if(url.pathname.endsWith('/hostel_snapshot'))data={room,placements,owner_name:profile.username};
      if(url.pathname.endsWith('/hostel_command')) {
        const d=body.p_data,a=body.p_action;
        if(!requests.has(body.p_request)) {
          requests.add(body.p_request);
          if(a==='purchase') {
            const price=d.item==='hostel_tv_basic'?500:300;
            if(d.credit)debts.push({id:'debt1',item_id:d.item,amount:330,due_at:new Date(Date.now()+172800000).toISOString(),paid_at:null});
            else wallet-=price;
            inventory.push({id:d.item,item_id:d.item,item_name:d.item,item_type:'hostel',quantity:1});
          }
          if(a==='place'){placements=placements.filter(p=>p.item_id!==d.item);if(d.anchor)placements.push({item_id:d.item,anchor:d.anchor,rotation:d.rotation});}
          if(a==='pay'){const debt=debts.find(x=>x.id===d.debt);if(!debt.paid_at){wallet-=debt.amount;debt.paid_at=new Date().toISOString();}}
          if(a==='tv')room.tv_on=!room.tv_on;
        }
        data={success:true};
      }
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
    page.setDefaultNavigationTimeout(120000);
    await page.goto('http://127.0.0.1:5178/', {waitUntil:'domcontentloaded'});

    page.setDefaultTimeout(60000);
    await page.getByRole('button',{name:'Enter Campus',exact:true}).click();
    await page.getByRole('button',{name:'Open campus phone'}).click();
    await page.getByRole('button',{name:'Home / Hostel',exact:true}).click();
    await page.getByRole('button',{name:'Go Hostel',exact:true}).click();
    await page.getByText('Off-campus courtyard',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Home controls'}).click();
    await page.getByRole('button',{name:'My Room',exact:true}).click();
    await page.getByText('CampusTester’s room',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Home controls'}).click();
    await page.getByRole('button',{name:'shop',exact:true}).click();
    await page.getByRole('button',{name:'Entertainment',exact:true}).click();
    const tv=page.locator('.hostel-items article').filter({has:page.getByRole('heading',{name:'TV',exact:true})});
    await tv.getByRole('button',{name:'Pay Now',exact:true}).click();
    await tv.getByRole('button',{name:'Owned',exact:true}).waitFor();
    assert.equal(wallet,7277);
    const speaker=page.locator('.hostel-items article').filter({has:page.getByRole('heading',{name:'Small Speaker',exact:true})});
    await speaker.getByRole('button',{name:'Credit · owe ₦330',exact:true}).click();
    await speaker.getByRole('button',{name:'Owned',exact:true}).waitFor();assert.equal(wallet,7277);
    await page.getByRole('button',{name:'My items',exact:true}).click();
    await page.locator('.hostel-items article').filter({has:page.getByRole('heading',{name:'TV ×1',exact:true})}).getByRole('button',{name:'Place',exact:true}).click();
    await page.getByRole('button',{name:'floor-b',exact:true}).click();
    await page.locator('.hostel-preview-controls').getByRole('button',{name:'Place',exact:true}).click();
    await page.getByText('Placed at floor-b',{exact:true}).waitFor();
    assert.equal(placements[0].anchor,'floor-b');
    assert(await page.locator('.hostel-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.screenshot({path:path.join(root,`hostel-${width}.png`)});
    await page.reload();
    await page.getByRole('button',{name:'Enter Campus',exact:true}).click();
    await page.getByRole('button',{name:'Open campus phone'}).click();
    await page.getByRole('button',{name:'Home / Hostel',exact:true}).click();
    await page.getByRole('button',{name:'My Room',exact:true}).click();
    await page.getByText('CampusTester’s room',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Home controls'}).click();
    await page.getByRole('button',{name:'My items',exact:true}).click();
    await page.getByText('Placed at floor-b',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Move / Rotate',exact:true}).click();
    await page.getByRole('button',{name:'floor-c',exact:true}).click();
    await page.getByRole('button',{name:'Rotate 0°',exact:true}).click();
    await page.locator('.hostel-preview-controls').getByRole('button',{name:'Place',exact:true}).click();
    await page.getByText('Placed at floor-c',{exact:true}).waitFor();assert.equal(placements[0].rotation,90);
    await page.getByRole('button',{name:'Return to inventory',exact:true}).click();
    await page.getByRole('button',{name:'Move / Rotate',exact:true}).waitFor({state:'hidden'});assert.equal(placements.length,0);
    await page.getByRole('button',{name:'debts',exact:true}).click();
    await page.getByRole('button',{name:'Pay ₦330',exact:true}).click();
    await page.getByText('Paid',{exact:true}).waitFor();assert.equal(wallet,6947);
    assert.equal(errors.length,0,errors.join('\n'));
    results.push({width,height,passed:true,wallet,placementsPersisted:true,creditPaid:true});
    await context.close();
  }
  await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
