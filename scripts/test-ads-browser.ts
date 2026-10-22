// Gate Plaza & billboards on a phone: screenshots of each, the to-let and billboard sheets, a rented
// shop's business sheet, the plaza directory, renting a shop (form, flyer, waiting for review) and the
// admin review page. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/ads', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const views: Array<[string, [number, number, number], number, number]> = [
  ['plaza', [-24, 0, 50], Math.PI, 0.18],
  ['plaza-stairs', [-31, 0, 50], Math.PI - 0.45, 0.2],
  ['plaza-back-from-gate', [-6, 0, 86], 0.75, 0.12],
  ['billboard-gate', [14, 0, 64], Math.PI, 0.02],
  ['billboard-sports', [-46, 0, -6], Math.PI / 2, 0.02],
  ['billboard-love-garden', [55, 0, -2], 0.75, 0.02],
  ['billboard-car-park', [-50, 0, 57], Math.PI / 2, 0.02],
];

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of [...phonesUnderTest().slice(0, 1), ...(process.env.ADS_WIDE ? [[1100, 700] as [number, number]] : [])]) {
      const errors: string[] = [];
      const calls: Record<string, any[]> = { submit_ad_request: [], review_ad_request: [] };
      const me = '00000000-0000-4000-8000-0000000000ad';
      let myRequests: any[] = [];
      const pending = { id: 'r1', spot_id: 'billboard-car-park', business_name: 'LeahBella', tagline: 'Go from craving to eating.', description: 'Food & treats.',
        contact: '0810 778 1980', link_url: 'https://wa.me/message/X', flyer_path: `${me}/abc.png`, created_at: new Date().toISOString(), username: 'leah', college: 'COLFHEC', spot_taken_until: null };
      const supabase = {
        car_garage: () => ({ cars: [] }),
        ad_my_state: () => ({ is_admin: true, pending_count: 1, my_spots: {}, my_requests: myRequests }),
        submit_ad_request: (body: any) => { calls.submit_ad_request.push(body); myRequests = [{ id: 'm1', spot_id: body.p_spot, business_name: body.p_business_name, status: 'pending', admin_note: null, created_at: new Date().toISOString() }]; return 'm1'; },
        admin_ad_state: () => ({ requests: calls.review_ad_request.length ? [] : [pending], listings: [{ spot_id: 'plaza-shop-2', business_name: 'Mama Tolu Kitchen', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * 864e5).toISOString(), owner: null, live: true }] }),
        review_ad_request: (body: any) => { calls.review_ad_request.push(body); return null; },
        ad_listings: () => [{ spot_id: 'plaza-shop-2', business_name: 'Mama Tolu Kitchen', tagline: 'Hot amala & ewedu, 7am–9pm', description: 'Home-cooked food for students.', flyer_url: null, link_url: 'https://example.com/mama-tolu', contact: '0800 000 0000' }],
      };
      const { context, page } = await openStudent(browser, { id: me, username: 'Ade', college: 'COLENG' }, { width, height, errors, supabase });
      try {
        await page.waitForFunction(async () => !!(await import('/src/stores/adStore.ts' as any)).useAdStore.getState().listings['plaza-shop-2']);
        // Scene shots with the HUD hidden so the plaza and boards are visible.
        const hud = await page.addStyleTag({ content: '*{visibility:hidden!important} canvas{visibility:visible!important}' });
        for (const [name, at, yaw, pitch] of views) {
          await page.evaluate(async ([at, yaw, pitch]: any) => {
            (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.setState({ teleport: at });
            const { useInputStore } = await import('/src/stores/inputStore.ts' as any);
            useInputStore.getState().setCameraYaw(yaw); useInputStore.getState().setCameraPitch(pitch);
          }, [at, yaw, pitch]);
          await page.waitForTimeout(2500);
          await page.screenshot({ path: path.join(out, `ads-${width}-${name}.png`) });
        }
        // Climb the stairs in the real game: tap-to-move from the stair foot up to the walkway.
        // (No named helpers inside evaluate: tsx would inject a __name call the page doesn't have.)
        const climb = await page.evaluate(async () => {
          const { PLAZA_STAIRS: st, PLAZA_SHOPS, GATE_PLAZA, plazaToWorld } = await import('/src/config/adSpaces.ts' as any);
          const { useHostelStore } = await import('/src/stores/hostelStore.ts' as any);
          const input = (await import('/src/stores/inputStore.ts' as any)).useInputStore.getState();
          const game = (await import('/src/stores/gameStore.ts' as any)).useGameStore;
          useHostelStore.setState({ teleport: plazaToWorld([st.cx, 0, st.bottomZ + 1]) });
          await new Promise((r) => setTimeout(r, 1500));
          input.setTargetDestination(plazaToWorld([st.cx, 0, GATE_PLAZA.footprint[1] / 2 + 0.8]));
          await new Promise((r) => setTimeout(r, 6000));
          const top = game.getState().myPosition;
          input.setTargetDestination(PLAZA_SHOPS.find((s: any) => s.id === 'plaza-shop-6').interactAt);
          await new Promise((r) => setTimeout(r, 6000));
          return { top, at: game.getState().myPosition, near: game.getState().nearbyInteractable?.targetId ?? null };
        });
        assert(climb.top[1] > 3.3, `climbed to the walkway: ${JSON.stringify(climb)}`);
        assert(climb.at[1] > 3.3 && climb.near === 'plaza-shop-6', `upstairs shop 6 in reach: ${JSON.stringify(climb)}`);
        await page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.getState().setCameraYaw(Math.PI); useInputStore.getState().setCameraPitch(0.35); });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(out, `ads-${width}-upstairs.png`) });
        await hud.evaluate((el: Element) => el.remove());
        const openSheet = async (id: string) => {
          await page.evaluate(async (id: string) => (await import('/src/stores/adStore.ts' as any)).useAdStore.getState().open(id), id);
          const sheet = page.getByRole('dialog');
          await sheet.waitFor();
          const b = await settledBox(page, sheet);
          assert(b.y + b.height <= height + 1 && b.width <= width, `${id} sheet fits`);
          return sheet;
        };
        let sheet = await openSheet('plaza-shop-1');
        assert.match(await sheet.innerText(), /Shop closed · to let/);
        await page.screenshot({ path: path.join(out, `ads-${width}-closed-shop.png`) });
        // Rent it: fill in the form with a flyer and send it for review.
        await sheet.getByRole('button', { name: 'Rent this shop' }).click();
        await sheet.getByLabel(/Business name/).fill('Styled by Smile');
        await sheet.getByLabel(/Short tagline/).fill('Hair, makeup & styling');
        await sheet.getByLabel(/Phone number/).fill('0806 431 8927');
        await sheet.getByLabel(/^Link/).fill('wa.me/message/IR27O7WGD3HAG1');
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        await sheet.getByLabel(/Flyer image/).setInputFiles({ name: 'flyer.png', mimeType: 'image/png', buffer: png });
        await sheet.getByRole('img', { name: 'Your flyer' }).waitFor();
        await page.screenshot({ path: path.join(out, `ads-${width}-rent-form.png`) });
        await sheet.getByRole('button', { name: 'Send for review' }).click();
        await sheet.getByText(/waiting for review/).waitFor();
        const sent = calls.submit_ad_request[0];
        assert.equal(sent.p_spot, 'plaza-shop-1');
        assert.equal(sent.p_business_name, 'Styled by Smile');
        assert.equal(sent.p_link_url, 'https://wa.me/message/IR27O7WGD3HAG1', 'link gets https://');
        assert.match(sent.p_flyer_path, new RegExp(`^${me}/[0-9a-f-]{36}\\.png$`), 'flyer uploaded to your own folder');
        await page.screenshot({ path: path.join(out, `ads-${width}-rent-waiting.png`) });
        sheet = await openSheet('plaza-shop-2');
        const text = await sheet.innerText();
        assert.match(text, /Mama Tolu Kitchen/); assert.match(text, /Hot amala/);
        assert.equal(await sheet.getByRole('link', { name: /Visit business/ }).getAttribute('href'), 'https://example.com/mama-tolu');
        await page.screenshot({ path: path.join(out, `ads-${width}-rented-shop.png`) });
        sheet = await openSheet('gate-plaza');
        assert.match(await sheet.innerText(), /1 of 8 shops open/);
        await page.screenshot({ path: path.join(out, `ads-${width}-directory.png`) });
        sheet = await openSheet('billboard-love-garden');
        assert.match(await sheet.innerText(), /Advertise here/);
        await page.screenshot({ path: path.join(out, `ads-${width}-billboard.png`) });
        // Admin: review the waiting request and approve it with its own flyer link.
        await sheet.getByRole('button', { name: /Review ad requests \(1\)/ }).click();
        sheet = page.getByRole('dialog');
        await sheet.getByText('LeahBella').waitFor();
        assert.match(await sheet.innerText(), /Car Park billboard · from @leah/);
        assert.match(await sheet.innerText(), /Mama Tolu Kitchen[\s\S]*Ends /);
        await page.screenshot({ path: path.join(out, `ads-${width}-admin.png`) });
        await sheet.getByRole('button', { name: /Approve/ }).click();
        await sheet.getByText('No requests waiting.').waitFor();
        const review = calls.review_ad_request[0];
        assert.equal(review.p_id, 'r1'); assert.equal(review.p_approve, true);
        assert.equal(review.p_flyer_url, `https://student-test.supabase.co/storage/v1/object/public/ad-flyers/${me}/abc.png`);
        assert.deepEqual(errors, []);
        console.log(`ADS BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
