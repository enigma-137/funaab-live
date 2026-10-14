-- 024: Room makeover. Apply once AFTER 023.
-- Paint your walls, change the floor, buy more furniture (plants, appliances, TV stand…), put
-- small items on a table or TV stand, and pay once to expand your room. Additive: purchases,
-- placements, debts and balances are untouched. Values mirror src/config/roomMakeover.ts and
-- src/config/hostelItems.ts (scripts/test-room-makeover-db.ts and test-economy-db.ts check drift).
begin;

-- 1. Room finishes and size.
alter table public.hostel_rooms
  add column if not exists wall_paint text not null default 'default',
  add column if not exists floor_style text not null default 'default',
  add column if not exists room_size text not null default 'standard' check (room_size in ('standard','large'));

create table public.hostel_finishes(
  kind text not null check (kind in ('paint','floor')),
  id text not null,
  price integer not null check (price >= 0),
  primary key (kind, id)
);
insert into public.hostel_finishes values
 ('paint','default',0),('paint','cream',300),('paint','sky',300),('paint','mint',300),('paint','lilac',300),
 ('paint','blush',300),('paint','sunshine',300),('paint','green',300),('paint','navy',300),
 ('floor','default',0),('floor','terrazzo',600),('floor','wood',800),('floor','tiles',700),('floor','carpet',900);
alter table public.hostel_finishes enable row level security;
create policy hostel_finishes_read on public.hostel_finishes for select to authenticated using (true);
revoke all on public.hostel_finishes from anon, authenticated;
grant select on public.hostel_finishes to authenticated;

-- 2. More items.
insert into public.hostel_catalog values
('hostel_tv_stand','TV Stand','Room',700,'floor',false,false),
('hostel_wardrobe','Wardrobe','Room',1500,'floor',false,false),
('hostel_bookshelf','Bookshelf','Room',600,'floor',false,false),
('hostel_bean_bag','Bean Bag','Room',500,'floor',false,false),
('hostel_mirror','Wall Mirror','Room',300,'wall',false,false),
('hostel_wall_clock','Wall Clock','Room',200,'wall',false,false),
('hostel_led_strip','LED Strip Lights','Room',400,'wall',false,false),
('hostel_plant_pot','Potted Plant','Plants',250,'floor',false,false),
('hostel_palm','Indoor Palm','Plants',450,'floor',false,false),
('hostel_flower_vase','Flower Vase','Plants',150,'desk',false,false),
('hostel_hanging_plant','Hanging Plant','Plants',300,'wall',false,false),
('hostel_washing_machine','Washing Machine','Appliances',2500,'floor',false,false),
('hostel_cooker','Gas Cooker','Appliances',1800,'floor',false,false),
('hostel_fridge','Mini Fridge','Appliances',2000,'floor',false,false),
('hostel_microwave','Microwave','Appliances',900,'desk',true,false)
on conflict (id) do nothing;

-- 3. The large room is 11 m wide instead of 8 m.
alter table public.room_placements drop constraint room_placements_bounds;
alter table public.room_placements add constraint room_placements_bounds
  check (x between -5.3 and 5.3 and z between -3.9 and 3.8 and y between 0 and 2.5);

-- Conservative rotated footprint. Kept in parity with src/config/hostelItems.ts.
create or replace function public.hostel_extent(p_item text,p_rotation integer) returns numeric[]
language plpgsql immutable set search_path=public as $$
-- cos/sin rounded to 6 places (as the client does) so a 90° turn is exactly 0/1, not 6e-17.
declare w numeric; d numeric; c numeric:=round(abs(cos(radians(p_rotation)))::numeric,6); s numeric:=round(abs(sin(radians(p_rotation)))::numeric,6);
begin
 select dims[1],dims[2] into w,d from (values
 ('hostel_pot',array[.66,.5]),('hostel_chair',array[.7,.7]),('hostel_table',array[1.2,.8]),('hostel_fan_basic',array[.6,.6]),
 ('hostel_rug',array[1.5,1.3]),('hostel_tv_basic',array[1.45,.4]),('hostel_generator_small',array[.8,.55]),
 ('hostel_gas_small_cylinder',array[.5,.5]),('hostel_poster',array[1.1,.08]),('hostel_curtain',array[1.5,.12]),
 ('hostel_bedsheet',array[1.2,1.9]),('hostel_pillow',array[.8,.45]),
 ('hostel_tv_stand',array[2.5,.5]),('hostel_wardrobe',array[1.2,.6]),('hostel_bookshelf',array[.9,.35]),
 ('hostel_bean_bag',array[.8,.8]),('hostel_mirror',array[.6,.06]),('hostel_wall_clock',array[.45,.06]),
 ('hostel_led_strip',array[2,.05]),('hostel_plant_pot',array[.5,.5]),('hostel_palm',array[.7,.7]),
 ('hostel_flower_vase',array[.3,.3]),('hostel_hanging_plant',array[.5,.1]),('hostel_washing_machine',array[.7,.65]),
 ('hostel_cooker',array[.75,.6]),('hostel_fridge',array[.6,.6]),('hostel_microwave',array[.5,.4])) t(id,dims) where id=p_item;
 w:=coalesce(w,.5);d:=coalesce(d,.4);return array[(c*w+s*d)/2,(s*w+c*d)/2];
end $$;

-- Furniture you can put things on, and the height of its top.
create function public.hostel_surface_height(p_item text) returns numeric
language sql immutable set search_path=public as $$
 select case p_item when 'hostel_table' then .77 when 'hostel_tv_stand' then .55 end
$$;

-- 4. Commands: decorate, expand, and placement/toggles that understand room size and surfaces.
alter function public.hostel_command(text,jsonb,uuid) rename to hostel_command_pre024;
revoke all on function public.hostel_command_pre024(text,jsonb,uuid) from public,anon,authenticated;

create function public.hostel_command(p_action text,p_data jsonb default '{}',p_request uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); room hostel_rooms; c hostel_catalog; result jsonb; px numeric; py numeric; pz numeric;
 r integer; a text; e numeric[]; other record; oe numeric[]; lim numeric; cost integer:=0; price integer; b numeric;
 wall text; floor text; old room_placements; h numeric; on_surface boolean;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_action not in ('place','toggle','decorate','expand') then return hostel_command_pre024(p_action,p_data,p_request); end if;
 if p_data->>'owner' is not null and (p_data->>'owner')::uuid<>u then raise exception 'Only the room owner can edit the room'; end if;
 perform 1 from profiles where id=u for update;
 select * into room from hostel_rooms where owner_id=u for update;
 if not found then raise exception 'Enter your room first'; end if;
 select receipt.result into result from hostel_receipts receipt where user_id=u and request_id=p_request;
 if found then return result; end if;

 if p_action in ('decorate','expand') then
  if p_action='decorate' then
   wall:=nullif(p_data->>'wall',''); floor:=nullif(p_data->>'floor','');
   if wall is null and floor is null then raise exception 'Choose a paint or a floor'; end if;
   if wall is not null then
    select f.price into price from hostel_finishes f where kind='paint' and id=wall;
    if not found then raise exception 'Unknown paint'; end if;
    if wall<>room.wall_paint then cost:=cost+price; end if;
   end if;
   if floor is not null then
    select f.price into price from hostel_finishes f where kind='floor' and id=floor;
    if not found then raise exception 'Unknown floor'; end if;
    if floor<>room.floor_style then cost:=cost+price; end if;
   end if;
  else
   if room.room_size='large' then raise exception 'Your room is already expanded'; end if;
   cost:=5000;
  end if;
  if cost>0 then
   select balance into b from wallets where user_id=u for update;
   if not found then raise exception 'Open your wallet first'; end if;
   if b<cost then raise exception 'Insufficient funds: this costs ₦%', cost; end if;
   update wallets set balance=balance-cost,updated_at=now() where user_id=u returning balance into b;
   insert into wallet_transactions(user_id,type,amount,balance_after,description) values(u,
    case when p_action='expand' then 'hostel_expand' else 'hostel_makeover' end,-cost,b,
    case when p_action='expand' then 'Room expansion' else 'Room makeover: '||concat_ws(' + ',
      case when wall is not null and wall<>room.wall_paint then 'paint ('||wall||')' end,
      case when floor is not null and floor<>room.floor_style then 'floor ('||floor||')' end) end);
  end if;
  if p_action='decorate' then
   update hostel_rooms set wall_paint=coalesce(wall,wall_paint), floor_style=coalesce(floor,floor_style) where owner_id=u;
  else
   update hostel_rooms set room_size='large' where owner_id=u;
  end if;
  result:=jsonb_build_object('success',true,'snapshot',hostel_snapshot(u));
  insert into hostel_receipts values(u,p_request,p_action,result); return result;
 end if;

 select * into c from hostel_catalog where id=p_data->>'item';
 if not found or not exists(select 1 from inventory where user_id=u and item_id=c.id and quantity>0) then raise exception 'Item is not owned'; end if;
 select * into old from room_placements where owner_id=u and item_id=c.id;
 lim:=case when room.room_size='large' then 5.3 else 3.8 end;

 if p_action='toggle' then
  if c.id not in('hostel_fan_basic','hostel_generator_small','hostel_washing_machine','hostel_cooker','hostel_fridge','hostel_led_strip') then raise exception 'Item has no switch'; end if;
  update room_placements set active=not active,updated_at=now() where owner_id=u and item_id=c.id;
  if not found then raise exception 'Place the item first'; end if;
 else
  -- Moving or removing a table / TV stand: take what's on it off first.
  h:=hostel_surface_height(c.id);
  if h is not null and old.item_id is not null then
   e:=hostel_extent(c.id,old.rotation);
   if exists(select 1 from room_placements p where p.owner_id=u and p.item_id<>c.id and abs(p.y-h)<.001
     and abs(p.x-old.x)<=e[1]+.001 and abs(p.z-old.z)<=e[2]+.001) then
    raise exception 'Take the items off the % first', c.name;
   end if;
  end if;
  if p_data->>'anchor' is null and not(p_data ? 'x') then
   delete from room_placements where owner_id=u and item_id=c.id;
   if c.id='hostel_tv_basic' then update hostel_rooms set tv_on=false where owner_id=u; end if;
  else
   if c.placement_type='none' then raise exception 'Item cannot be placed'; end if;
   r:=coalesce((p_data->>'rotation')::integer,0);
   if r<0 or r>=360 or r%45<>0 then raise exception 'Invalid rotation'; end if;
   if p_data ? 'x' then px:=(p_data->>'x')::numeric;py:=(p_data->>'y')::numeric;pz:=(p_data->>'z')::numeric;
   else
    -- Old clients may still send anchor-only commands. Convert, then validate normally.
    a:=p_data->>'anchor';
    if split_part(a,'-',1)<>c.placement_type then raise exception 'Invalid placement anchor'; end if;
    select v.x,v.y,v.z into px,py,pz from (values
     ('floor-a',-2,0,0),('floor-b',2,0,-2),('floor-c',2,0,1),('floor-d',-2,0,2),
     ('wall-a',0,1.8,-3.84),('wall-b',2.25,1.8,-3.84),('desk-a',1.75,0,-2),('desk-b',2.25,0,-2),
     ('bed-a',-2.6,.32,-2.8),('bed-b',-2.6,.32,-3.45)) v(anchor,x,y,z) where v.anchor=a;
   end if;
   if px is null or py is null or pz is null or px::text in('NaN','Infinity','-Infinity') or py::text in('NaN','Infinity','-Infinity') or pz::text in('NaN','Infinity','-Infinity') then raise exception 'Invalid coordinates'; end if;
   e:=hostel_extent(c.id,r);
   if c.placement_type='wall' then
    if r<>0 or abs(px)+e[1]>lim or py<>1.8 or abs(pz+3.84)>.001 then raise exception 'Attach this item to the back wall'; end if;
    if exists(select 1 from room_placements p join hostel_catalog hc on hc.id=p.item_id where p.owner_id=u and p.item_id<>c.id and hc.placement_type='wall' and abs(p.x-px)<e[1]+(hostel_extent(p.item_id,p.rotation))[1]) then raise exception 'Wall space is occupied'; end if;
   elsif c.placement_type='bed' then
    if r<>0 or px<>-2.6 or py<>.32 or pz<>(case when c.id='hostel_pillow' then -3.45 else -2.8 end) then raise exception 'Place bedding on the mattress'; end if;
   elsif py>0 then
    -- On a table or TV stand: small items and the TV only, fully on the top, not on each other.
    if not (c.placement_type='desk' or c.id='hostel_tv_basic') then raise exception 'This item goes on the floor'; end if;
    on_surface:=false;
    for other in select p.* from room_placements p where p.owner_id=u and hostel_surface_height(p.item_id) is not null loop
     oe:=hostel_extent(other.item_id,other.rotation);
     if abs(py-hostel_surface_height(other.item_id))<.001 and abs(px-other.x)+e[1]<=oe[1]+.001 and abs(pz-other.z)+e[2]<=oe[2]+.001 then on_surface:=true; end if;
    end loop;
    if not on_surface then raise exception 'Put it on a table or TV stand'; end if;
    for other in select p.* from room_placements p where p.owner_id=u and p.item_id<>c.id and abs(p.y-py)<.001 loop
     oe:=hostel_extent(other.item_id,other.rotation);
     if abs(px-other.x)<e[1]+oe[1] and abs(pz-other.z)<e[2]+oe[2] then raise exception 'That spot is taken'; end if;
    end loop;
   else
    if py<>0 or abs(px)+e[1]>lim or abs(pz)+e[2]>3.8 then raise exception 'Keep furniture on the room floor'; end if;
    if abs(px)<e[1]+.8 and pz+e[2]>2.6 then raise exception 'Keep the entrance clear'; end if;
    if c.id<>'hostel_rug' then
     if abs(px+2.6)<e[1]+.625 and abs(pz+2.8)<e[2]+1 then raise exception 'Leave space for the mattress'; end if;
     for other in select p.* from room_placements p join hostel_catalog hc on hc.id=p.item_id
       where p.owner_id=u and p.item_id<>c.id and p.item_id<>'hostel_rug' and p.y=0 and hc.placement_type not in('wall','bed') loop
      oe:=hostel_extent(other.item_id,other.rotation);
      if abs(px-other.x)<e[1]+oe[1]+.05 and abs(pz-other.z)<e[2]+oe[2]+.05 then raise exception 'That space is occupied'; end if;
     end loop;
    end if;
   end if;
   insert into room_placements(owner_id,item_id,anchor,rotation,x,y,z) values(u,c.id,'free:'||c.id,r,px,py,pz)
    on conflict(owner_id,item_id) do update set anchor=excluded.anchor,rotation=excluded.rotation,x=excluded.x,y=excluded.y,z=excluded.z,updated_at=now();
  end if;
 end if;
 result:=jsonb_build_object('success',true,'snapshot',hostel_snapshot(u));
 insert into hostel_receipts values(u,p_request,p_action,result); return result;
end $$;
revoke all on function public.hostel_extent(text,integer),public.hostel_surface_height(text),public.hostel_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hostel_command(text,jsonb,uuid) to authenticated;

commit;
