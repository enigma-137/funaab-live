-- 054 Home kitchen: cook foodstuff from Iya Ibeji and serve it on your Small Table, like a restaurant.
-- One plate of food and one drink can stand on the table. Everyone in the room sees them (they ride on
-- the room snapshot), and the owner or any guest in the room can eat or drink what's served.
-- Cooked dishes (rice, indomie, spaghetti, eggs) need a Pot and a Gas Cooker or Gas Cylinder in the
-- room; garri, bread and water are served as they are. src/config/homeKitchen.ts mirrors these rules.
begin;

alter table public.hostel_rooms
 add column if not exists served_food text references public.hostel_catalog(id),
 add column if not exists served_drink text references public.hostel_catalog(id),
 add column if not exists served_at timestamptz;

create or replace function public.hostel_kitchen(p_action text, p_data jsonb default '{}', p_request uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); o uuid; c hostel_catalog; n integer; v_slot text; v_room hostel_rooms; result jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 perform 1 from profiles where id=u for update;
 select r.result into result from hostel_receipts r where user_id=u and request_id=p_request;
 if found then return result; end if;

 if p_action='serve' then
  o := u;
  select * into c from hostel_catalog where id=p_data->>'item' and category='Foodstuff' and consumable;
  if not found then raise exception 'Only foodstuff can be served'; end if;
  select * into v_room from hostel_rooms where owner_id=u for update;
  if not found then raise exception 'Open your room first'; end if;
  if not exists(select 1 from room_placements where owner_id=u and item_id='hostel_table') then
   raise exception 'Place your Small Table first: food is served on the table'; end if;
  v_slot := case when c.id='hostel_food_water' then 'drink' else 'food' end;
  if (v_slot='food' and v_room.served_food is not null) or (v_slot='drink' and v_room.served_drink is not null) then
   raise exception 'The table already has %. Eat it first', case when v_slot='food' then 'food on it' else 'a drink on it' end; end if;
  if c.id in ('hostel_food_rice','hostel_food_indomie','hostel_food_spaghetti','hostel_food_eggs') then
   if not exists(select 1 from inventory where user_id=u and item_id='hostel_pot' and quantity>0) then
    raise exception 'Buy a Pot from Iya Ibeji to cook'; end if;
   if not exists(select 1 from room_placements where owner_id=u and item_id in ('hostel_cooker','hostel_gas_small_cylinder')) then
    raise exception 'Place a Gas Cooker or Gas Cylinder in your room to cook'; end if;
  end if;
  select quantity into n from inventory where user_id=u and item_id=c.id for update;
  if n is null or n<1 then raise exception 'Buy % from Iya Ibeji first', c.name; end if;
  if n=1 then delete from inventory where user_id=u and item_id=c.id;
  else update inventory set quantity=quantity-1 where user_id=u and item_id=c.id; end if;
  if v_slot='food' then update hostel_rooms set served_food=c.id, served_at=now() where owner_id=u;
  else update hostel_rooms set served_drink=c.id, served_at=now() where owner_id=u; end if;

 elsif p_action='eat' then
  o := coalesce((p_data->>'owner')::uuid, u);
  v_slot := p_data->>'slot';
  if v_slot not in ('food','drink') then raise exception 'Choose food or drink'; end if;
  if not hostel_can_enter(o,u) then raise exception 'You are not in this room'; end if;
  select * into v_room from hostel_rooms where owner_id=o for update;
  if not found or (v_slot='food' and v_room.served_food is null) or (v_slot='drink' and v_room.served_drink is null) then
   raise exception 'Nothing is served'; end if;
  if v_slot='food' then update hostel_rooms set served_food=null where owner_id=o;
  else update hostel_rooms set served_drink=null where owner_id=o; end if;

 else raise exception 'Unknown kitchen action'; end if;

 result := jsonb_build_object('success',true,'owner',o,'snapshot',hostel_snapshot(o));
 insert into hostel_receipts values(u,p_request,'kitchen:'||p_action,result);
 return result;
end $$;
revoke all on function public.hostel_kitchen(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hostel_kitchen(text,jsonb,uuid) to authenticated;

commit;
