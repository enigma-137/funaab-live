-- 027: COLENG food delivery is counted at the door. Apply once AFTER 026 (safe to re-run).
-- The drop-off was a point on the open forecourt 6 m from COLENG's door with a 5 m radius, so
-- students who walked up to the door never got a Deliver button. Jobs now have their own
-- drop-off radius; the COLENG delivery is centred just in front of the door with 7.5 m.
-- Mirrors src/config/campusJobs.ts (scripts/test-economy-db.ts checks drift). Reward unchanged.
begin;

alter table public.job_catalog add column if not exists dest_radius numeric not null default 5;
update public.job_catalog set dest_x=80, dest_z=-54, dest_radius=7.5 where id='job-food-delivery';

-- Same as 012, except the delivery check uses the job's own radius.
create or replace function public.job_action_trusted(p_user uuid,p_action text,p_job text default null,p_run uuid default null,p_x numeric default null,p_z numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j job_catalog; r job_runs; b numeric; v_bonus integer := 0;
 v_day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
 perform 1 from profiles where id=p_user for update;
 if not found then raise exception 'Profile missing'; end if;
 if p_action='accept' then
  select * into r from job_runs where user_id=p_user and status in('accepted','picked_up');
  if found then return to_jsonb(r); end if;
  select * into j from job_catalog where id=p_job;
  if not found then raise exception 'Unknown job'; end if;
  if (select count(*) from job_runs where user_id=p_user and completed_at>now()-interval '24 hours')>=12 then raise exception 'Daily shift limit reached'; end if;
  if exists(select 1 from job_runs where user_id=p_user and job_id=p_job and completed_at>now()-interval '5 minutes') then raise exception 'This job resets five minutes after completion'; end if;
  insert into job_runs(user_id,job_id) values(p_user,p_job) returning * into r;
 else
  select * into r from job_runs where id=p_run and user_id=p_user for update;
  if not found then raise exception 'Active job not found'; end if;
  select * into j from job_catalog where id=r.job_id;
  if r.status='completed' then return to_jsonb(r); end if;
  if p_action='cancel' and r.status in('accepted','picked_up') then
   update job_runs set status='cancelled' where id=r.id returning * into r;
  elsif p_action='pickup' then
   if r.status<>'accepted' then raise exception 'Order already collected'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.source_x,2)+power(p_z-j.source_z,2))>5 then raise exception 'Go to the pickup marker'; end if;
   if now()<r.accepted_at+interval '3 seconds' then raise exception 'Wait for the order to be ready'; end if;
   update job_runs set status='picked_up',pickup_at=now() where id=r.id returning * into r;
  elsif p_action='deliver' then
   if r.status<>'picked_up' or r.pickup_at is null then raise exception 'Collect the order first'; end if;
   if p_x is null or p_z is null or sqrt(power(p_x-j.dest_x,2)+power(p_z-j.dest_z,2))>j.dest_radius then raise exception 'Go to the correct destination'; end if;
   if now()<r.pickup_at+interval '15 seconds' then raise exception 'Complete the route or station check first (15 seconds minimum)'; end if;
   select balance into b from wallets where user_id=p_user for update;
   if b is null then raise exception 'Open your wallet first'; end if;
   -- Bonus only for the first completion of the Lagos day; this run is not completed yet, and the
   -- profile lock above serializes concurrent deliveries, so it cannot be paid twice.
   if not exists(select 1 from job_runs where user_id=p_user and status='completed' and completed_at>=v_day_start) then
    v_bonus := 200;
   end if;
   update wallets set balance=balance+j.reward,updated_at=now() where user_id=p_user returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job',j.reward,b,j.title,jsonb_build_object('job_run',r.id));
   if v_bonus > 0 then
    update wallets set balance=balance+v_bonus,updated_at=now() where user_id=p_user returning balance into b;
    insert into wallet_transactions(user_id,type,amount,balance_after,description,metadata) values(p_user,'campus_job_bonus',v_bonus,b,'First job of the day bonus',jsonb_build_object('job_run',r.id));
   end if;
   update job_runs set status='completed',completed_at=now(),reward_claimed=true where id=r.id returning * into r;
   return to_jsonb(r) || jsonb_build_object('paid',j.reward,'bonus',v_bonus);
  else raise exception 'Invalid job action'; end if;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.job_action_trusted(uuid,text,text,uuid,numeric,numeric) to service_role;

commit;
