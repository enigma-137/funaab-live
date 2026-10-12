const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;`);
 for(const file of fs.readdirSync(path.join(__dirname,'../supabase/migrations')).sort())await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
 const u='00000000-0000-4000-8000-000000000001',ticket='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values($1)',[u]);await db.query("insert into profiles(id,username,college) values($1,'Rider','COLENG')",[u]);await db.query('insert into wallets(user_id,balance) values($1,100)',[u]);
 const reserve=()=>db.query('select keke_reserve_trusted($1,$2,$3,$4)',[ticket,u,'library',50]);
 await reserve();await reserve();assert.equal(Number((await db.query('select balance from wallets')).rows[0].balance),50);
 await assert.rejects(()=>db.query('select keke_reserve_trusted($1,$2,$3,$4)',[second,u,'colvet',90]));
 await db.query("select keke_settle_trusted($1,'refund')",[ticket]);await db.query("select keke_settle_trusted($1,'refund')",[ticket]);assert.equal(Number((await db.query('select balance from wallets')).rows[0].balance),100);
 await assert.rejects(reserve);
 await db.query('select keke_reserve_trusted($1,$2,$3,$4)',[second,u,'colvet',90]);await db.query("select keke_settle_trusted($1,'complete')",[second]);await db.query("select keke_settle_trusted($1,'refund')",[second]);assert.equal(Number((await db.query('select balance from wallets')).rows[0].balance),10);
 await db.exec('set role authenticated');await assert.rejects(reserve);await assert.rejects(()=>db.query("select keke_settle_trusted($1,'refund')",[second]));await db.exec('reset role');
 assert.equal((await db.query('select count(*) as n from wallet_transactions')).rows[0].n,3);
 const job=(await db.query("select dest_x,dest_z from job_catalog where id='job-food-delivery'")).rows[0];assert.equal(Number(job.dest_x),80);assert.equal(Number(job.dest_z),-51); // moved with the enlarged COLENG forecourt (migration 012)
 console.log('KEKE DATABASE PASSED: migrations 001–009, atomic debit, duplicate receipt, insufficient funds, one refund, completed receipt, replay rejection, service-only RPCs and relocated jobs.');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
