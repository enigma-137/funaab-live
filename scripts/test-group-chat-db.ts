// Group chats (migration 047): friends only, admin powers, 20 people and 5 groups each,
// no links, slow-down on spam, last 200 kept, unread counts, admin handover; drift with src/config/groupChat.ts.
// Run: npm run test:groups:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GROUP_CHAT, LINK_PATTERN, hasLink } from '../src/config/groupChat';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const sql = fs.readFileSync(path.join(dir, '047_group_chats.sql'), 'utf8');
  await db.exec(sql); // re-runnable
  const rows = async (q: string, p: unknown[] = []) => (await db.query(q, p)).rows as any[];
  const call = async (user: string | null, q: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(q, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, q: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => call(user, q, p), re);
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    return id;
  };
  const befriend = (a: string, b: string) => db.query("insert into friends(user_id,friend_id,status) values($1,$2,'accepted')", [a, b]);
  // Spam limits are per second / minute: step the clock back on earlier messages instead of waiting.
  const age = (u: string) => db.query("update chat_group_messages set created_at=created_at-interval '2 seconds' where sender_id=$1", [u]);
  const send = async (u: string, g: string, body: string) => { await age(u); return (await call(u, 'select group_send($1,$2) r', [g, body])).r; };

  // Drift: limits and the link pattern match the client.
  assert(sql.includes(`>= ${GROUP_CHAT.maxOwned} then`) && sql.includes(`> ${GROUP_CHAT.maxMembers - 1} then`) && sql.includes(`>= ${GROUP_CHAT.maxMembers} then`), 'member and group limits');
  assert(sql.includes(`between 1 and ${GROUP_CHAT.nameMax}`) && sql.includes(`between 1 and ${GROUP_CHAT.messageMax}`) && sql.includes(`mid - ${GROUP_CHAT.keep}`) && sql.includes(`>= ${GROUP_CHAT.perMinute} then`), 'text limits');
  assert(sql.includes(`~* '${LINK_PATTERN}'`), 'link pattern matches src/config/groupChat.ts');
  for (const t of ['https://x.com', 'join chat.whatsapp.com/x', 'wa.me/234', 't.me/abc', 'google . com', 'funaab(dot)edu(dot)ng', 'www.site', 'bit.ly/x', 'Visit FUNAAB.EDU.NG'])
    assert.equal((await rows('select chat_has_link($1) l', [t]))[0].l, true, `db sees a link: ${t}`), assert(hasLink(t), `client sees a link: ${t}`);
  for (const t of ['coming.in a bit', 'see you at 5.30', 'e.g. this one', 'meet at Zoology', 'call.me later', 'ok.to go'])
    assert.equal((await rows('select chat_has_link($1) l', [t]))[0].l, false, `db: not a link: ${t}`), assert(!hasLink(t), `client: not a link: ${t}`);

  const ada = await student('Ada'), bola = await student('Bola'), chi = await student('Chi'), dan = await student('Dan'), eve = await student('Eve');
  await befriend(ada, bola); await befriend(chi, ada); await befriend(ada, dan); // either direction counts

  // Tables are closed; only the functions work.
  await fails(ada, 'select * from chat_group_messages', /permission denied/);
  await fails(null, "select group_create('x')", /permission denied|Authentication/);

  // Create: friends only, clean name, no links.
  await fails(ada, "select group_create('  ')", /Give the group a name/);
  await fails(ada, "select group_create('Join wa.me/234')", /Links are not allowed/);
  await fails(ada, 'select group_create($1,$2)', /only add friends/, ['Squad', [eve]]);
  assert.equal(Number((await rows('select count(*) c from chat_groups'))[0].c), 0, 'a failed create leaves nothing behind');
  const made = (await call(ada, 'select group_create($1,$2) r', ['  COLENG   200L ', [bola, chi]])).r;
  const g = made.id as string;
  assert.equal(made.name, 'COLENG 200L');
  assert.deepEqual(made.members, [ada, bola, chi]);

  // Messages: members only, no links, and the others see them as unread.
  await fails(eve, 'select group_send($1,$2)', /not in this group/, [g, 'hi']);
  await fails(eve, 'select group_messages($1)', /not in this group/, [g]);
  await fails(bola, 'select group_send($1,$2)', /Links are not allowed/, [g, 'see https://scam.example']);
  await fails(bola, 'select group_send($1,$2)', /Type a message/, [g, '   ']);
  await fails(bola, 'select group_send($1,$2)', /500 characters/, [g, 'x'.repeat(501)]);
  const sent = await send(bola, g, 'Who is coming to Zoology?');
  assert.deepEqual(sent.members, [ada, bola, chi], 'send returns who to ping');
  let list = (await call(chi, 'select group_list() l')).l;
  assert.equal(list.length, 1); assert.equal(list[0].name, 'COLENG 200L'); assert.equal(Number(list[0].count), 3);
  assert.equal(Number(list[0].unread), 3, 'two system notes and Bola’s message are unread for Chi');
  assert.equal(list[0].last.body, 'Who is coming to Zoology?'); assert.equal(list[0].last.sender, 'Bola');
  assert.equal(Number((await call(bola, 'select group_list() l')).l[0].unread), 0, 'your own messages are read');
  const view = (await call(chi, 'select group_messages($1) v', [g])).v;
  assert.deepEqual(view.messages.map((m: any) => [m.kind, m.body]), [['system', 'Ada created the group'], ['system', 'Ada added Bola, Chi'], ['text', 'Who is coming to Zoology?']]);
  assert.equal(view.owner, ada); assert.deepEqual(view.members.map((m: any) => m.username), ['Ada', 'Bola', 'Chi']);
  assert.equal(Number((await call(chi, 'select group_list() l')).l[0].unread), 0, 'opening the group reads it');
  const after = (await call(chi, 'select group_messages($1,$2) v', [g, sent.id])).v;
  assert.equal(after.messages.length, 0, 'only newer messages after an id');

  // Spam: one a second, twenty a minute.
  await age(chi); await call(chi, 'select group_send($1,$2)', [g, 'me!']);
  await fails(chi, 'select group_send($1,$2)', /Slow down/, [g, 'me again']);
  await db.query("update chat_group_messages set created_at=now()-interval '5 seconds' where sender_id=$1", [chi]);
  for (let i = 1; i < GROUP_CHAT.perMinute; i++) await db.query("insert into chat_group_messages(group_id,sender_id,body,created_at) values($1,$2,'x',now()-interval '10 seconds')", [g, chi]);
  await fails(chi, 'select group_send($1,$2)', /Slow down/, [g, 'one more']);
  await db.query("update chat_group_messages set created_at=now()-interval '2 minutes' where sender_id=$1", [chi]);
  await call(chi, 'select group_send($1,$2)', [g, 'back']);

  // Admin powers: add friends only, remove, rename. Others can't.
  await fails(bola, 'select group_add($1,$2)', /Only the group admin/, [g, dan]);
  await fails(ada, 'select group_add($1,$2)', /only add friends/, [g, eve]);
  await fails(ada, 'select group_add($1,$2)', /Already in the group/, [g, bola]);
  await call(ada, 'select group_add($1,$2)', [g, dan]);
  await fails(chi, 'select group_rename($1,$2)', /Only the group admin/, [g, 'Mine']);
  await fails(ada, 'select group_rename($1,$2)', /Links are not allowed/, [g, 'bit.ly/x']);
  await call(ada, 'select group_rename($1,$2)', [g, 'Zoology crew']);
  await fails(bola, 'select group_remove($1,$2)', /Only the group admin/, [g, dan]);
  await fails(ada, 'select group_remove($1,$2)', /Leave group/, [g, ada]);
  await call(ada, 'select group_remove($1,$2)', [g, dan]);
  await fails(dan, 'select group_messages($1)', /not in this group/, [g]);
  const notes = (await call(bola, 'select group_messages($1) v', [g])).v.messages.filter((m: any) => m.kind === 'system').map((m: any) => m.body);
  assert.deepEqual(notes.slice(-3), ['Ada added Dan', 'Ada renamed the group to Zoology crew', 'Ada removed Dan']);

  // 20 people at most.
  const many: string[] = [];
  for (let i = 0; i < GROUP_CHAT.maxMembers; i++) { const s = await student(`S${i}`); await befriend(dan, s); many.push(s); }
  await fails(dan, 'select group_create($1,$2)', /20 people at most/, ['Big', many]);
  const big = (await call(dan, 'select group_create($1,$2) r', ['Big', many.slice(0, GROUP_CHAT.maxMembers - 1)])).r;
  assert.equal(big.members.length, GROUP_CHAT.maxMembers);
  await fails(dan, 'select group_add($1,$2)', /20 people at most/, [big.id, many[GROUP_CHAT.maxMembers - 1]]);

  // 5 groups each.
  for (let i = 1; i < GROUP_CHAT.maxOwned; i++) await call(dan, 'select group_create($1)', [`G${i}`]);
  await fails(dan, "select group_create('One too many')", /5 groups at most/);

  // Last 200 kept.
  await db.query("insert into chat_group_messages(group_id,sender_id,body,created_at) select $1,$2,'old '||i,now()-interval '1 hour' from generate_series(1,250) i", [g, bola]);
  await send(bola, g, 'newest');
  const kept = await rows('select count(*) c, max(body) filter (where id=(select max(id) from chat_group_messages where group_id=$1)) last from chat_group_messages where group_id=$1', [g]);
  assert.equal(Number(kept[0].c), GROUP_CHAT.keep); assert.equal(kept[0].last, 'newest');
  assert.equal((await call(chi, 'select group_messages($1) v', [g])).v.messages.length, 100, 'a page is 100 messages');

  // Admin leaves: the longest-standing member takes over. Last one out deletes the group.
  await fails(eve, 'select group_leave($1)', /Not in the group/, [g]);
  const left = (await call(ada, 'select group_leave($1) r', [g])).r;
  assert.equal(left.deleted, false); assert.deepEqual(left.members, [bola, chi]);
  const v2 = (await call(bola, 'select group_messages($1) v', [g])).v;
  assert.equal(v2.owner, bola, 'Bola is now the admin');
  assert.deepEqual(v2.messages.slice(-2).map((m: any) => m.body), ['Ada left', 'Bola is now the admin']);
  assert.equal((await call(ada, 'select group_list() l')).l.length, 0);
  await call(chi, 'select group_leave($1)', [g]);
  assert.equal((await call(bola, 'select group_leave($1) r', [g])).r.deleted, true);
  assert.equal(Number((await rows('select count(*) c from chat_group_messages where group_id=$1', [g]))[0].c), 0, 'messages go with the group');

  console.log('GROUP CHAT DB PASSED: friends only, admin add/remove/rename, 20 people and 5 groups, no links, spam slow-down, last 200 kept, unread counts, admin handover, drift.');
}
main().catch((e) => { console.error(e); process.exit(1); });
