// Cars and fuel (migration 045): garage with starter fuel, fuel bought at ₦150/L up to a 40 L tank,
// fuel burnt in small steps and never below empty, only for cars you own; drift with src/config/cars.ts.
// Run: npm run test:cars:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CAR_MODELS, FUEL, fuelPrice } from '../src/config/cars';
import { HOSTEL_SHOP } from '../src/config/hostelItems';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  await db.exec(fs.readFileSync(path.join(dir, '045_cars_fuel.sql'), 'utf8')); // re-runnable
  const sql = fs.readFileSync(path.join(dir, '045_cars_fuel.sql'), 'utf8');
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const one = async (q: string, p: unknown[] = []) => (await rows(q, p))[0];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, q: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => call(user, q, p), re);
  let n = 0;
  const student = async (name: string, money: number) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await call(id, 'select ensure_player_wallet()');
    await db.query('update wallets set balance=$2 where user_id=$1', [id, money]);
    return id;
  };
  const balance = async (u: string) => Number((await one('select balance from wallets where user_id=$1', [u])).balance);
  const buyCar = (u: string, car: string) => call(u, "select hostel_command('purchase',$1::jsonb)", [JSON.stringify({ item: car, credit: false })]);

  // Drift: every car model is a shop car; tank, price, starter fuel and burn cap match.
  for (const id of Object.keys(CAR_MODELS)) assert.equal(HOSTEL_SHOP.find((i) => i.id === id)?.category, 'Cars', `${id} sold in the shop`);
  assert(sql.includes(`between 0 and ${FUEL.tankLitres}`) && sql.includes(`*${FUEL.pricePerLitre};`) && sql.includes(`default ${FUEL.starterLitres}`) && sql.includes(`p_litres>${FUEL.maxBurnPerReport}`), 'fuel rules match config');

  const ada = await student('Ada', 600000);
  await fails(null, 'select car_garage()', /permission denied|Authentication/);
  assert.deepEqual((await call(ada, 'select car_garage() g')).g.cars, [], 'no cars yet');
  await fails(ada, "select buy_fuel('car_corolla',5)", /not your car/);
  await buyCar(ada, 'car_corolla');
  const g = (await call(ada, 'select car_garage() g')).g;
  assert.deepEqual(g.cars.map((c: any) => [c.car, Number(c.litres)]), [['car_corolla', FUEL.starterLitres]], 'a new car comes with starter fuel');

  // Buy fuel: charged per litre, capped at the tank.
  let b = await balance(ada);
  const r = (await call(ada, "select buy_fuel('car_corolla',10) r")).r;
  assert.equal(Number(r.litres), 20); assert.equal(Number(r.cost), fuelPrice(10));
  assert.equal(await balance(ada), b - fuelPrice(10));
  const full = (await call(ada, "select buy_fuel('car_corolla',99) r")).r;
  assert.equal(Number(full.litres), FUEL.tankLitres); assert.equal(Number(full.bought), 20, 'only what fits');
  await fails(ada, "select buy_fuel('car_corolla',1)", /already full/);
  assert.equal(Number((await one("select count(*) n from wallet_transactions where user_id=$1 and type='fuel'", [ada])).n), 2);

  // Burn: small steps only, never below empty.
  await fails(ada, "select burn_fuel('car_corolla',5)", /Invalid fuel report/);
  await fails(ada, "select burn_fuel('car_corolla',-1)", /Invalid fuel report/);
  assert.equal(Number((await call(ada, "select burn_fuel('car_corolla',1.5) l")).l), 38.5);
  for (let i = 0; i < 25; i++) await call(ada, "select burn_fuel('car_corolla',2)");
  assert.equal(Number((await call(ada, "select burn_fuel('car_corolla',2) l")).l), 0, 'empty, not negative');

  // Someone else's car, or not enough money.
  const bisi = await student('Bisi', 160000);
  await fails(bisi, "select burn_fuel('car_corolla',1)", /not your car/);
  await buyCar(bisi, 'car_corolla');
  await db.query('update wallets set balance=100 where user_id=$1', [bisi]);
  await fails(bisi, "select buy_fuel('car_corolla',10)", /Top up/);
  await fails(ada, `select owns_car('${ada}','car_corolla')`, /permission denied/);
  console.log('CARS DB PASSED: garage with starter fuel, ₦150/L capped at the tank, burn in small steps and never below empty, owners only, funds, drift.');
}
main().catch((e) => { console.error(e); process.exit(1); });
