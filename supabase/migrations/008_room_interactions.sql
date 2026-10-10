-- Apply AFTER 007. Preserves purchases, IDs, prices, balances and existing placements.
begin;
alter table room_placements add column x numeric, add column y numeric, add column z numeric,
 add column active boolean not null default false, add column updated_at timestamptz not null default now();
update room_placements p set x=a.x,y=a.y,z=a.z from (values
 ('floor-a',-2,0,0),('floor-b',2,0,-2),('floor-c',2,0,1),('floor-d',-2,0,2),
 ('wall-a',0,1.8,-3.8),('wall-b',2.3,1.8,-3.8),('desk-a',1.7,.8,-2),('desk-b',2.3,.8,-2),
 ('bed-a',-2.6,.3,-2.7),('bed-b',-2.6,.4,-3.3)) a(anchor,x,y,z) where p.anchor=a.anchor;
alter table room_placements alter column x set not null,alter column y set not null,alter column z set not null;
alter table room_placements drop constraint room_placements_rotation_check;
alter table room_placements add constraint room_placements_rotation_check check(rotation>=0 and rotation<360 and rotation%45=0);
alter table room_placements add constraint room_placements_bounds check(x between -3.8 and 3.8 and z between -3.9 and 3.8 and y between 0 and 2.5);

-- Conservative rotated footprint. Kept in parity with src/config/hostelItems.ts.
create function hostel_extent(p_item text,p_rotation integer) returns numeric[]
language plpgsql immutable set search_path=public as $$
declare w numeric; d numeric; c numeric:=abs(cos(radians(p_rotation))); s numeric:=abs(sin(radians(p_rotation)));
begin
 select dims[1],dims[2] into w,d from (values
 ('hostel_pot',array[.66,.5]),('hostel_chair',array[.7,.7]),('hostel_table',array[1.2,.8]),('hostel_fan_basic',array[.6,.6]),
 ('hostel_rug',array[1.5,1.3]),('hostel_tv_basic',array[1.45,.4]),('hostel_generator_small',array[.8,.55]),
 ('hostel_gas_small_cylinder',array[.5,.5]),('hostel_poster',array[1.1,.08]),('hostel_curtain',array[1.5,.12]),
 ('hostel_bedsheet',array[1.2,1.9]),('hostel_pillow',array[.8,.45])) t(id,dims) where id=p_item;
 w:=coalesce(w,.5);d:=coalesce(d,.4);return array[(c*w+s*d)/2,(s*w+c*d)/2];
end $$;

alter function hostel_command(text,jsonb,uuid) rename to hostel_command_pre008;
revoke all on function hostel_command_pre008(text,jsonb,uuid) from public,anon,authenticated;
create function hostel_command(p_action text,p_data jsonb default '{}',p_request uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); c hostel_catalog; old room_placements; result jsonb; px numeric; py numeric; pz numeric;
 r integer; a text; e numeric[]; other record; oe numeric[];
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_action not in ('place','toggle','tv') then return hostel_command_pre008(p_action,p_data,p_request);end if;
 if p_data->>'owner' is not null and (p_data->>'owner')::uuid<>u then raise exception 'Only the room owner can edit furniture';end if;
 perform 1 from profiles where id=u for update;
 perform 1 from hostel_rooms where owner_id=u for update;
 if not found then raise exception 'Enter your room first';end if;
 select receipt.result into result from hostel_receipts receipt where user_id=u and request_id=p_request;
 if found then return result;end if;
 if p_action='tv' then return hostel_command_pre008(p_action,p_data,p_request);end if;
 select * into c from hostel_catalog where id=p_data->>'item';
 if not found or not exists(select 1 from inventory where user_id=u and item_id=c.id and quantity>0) then raise exception 'Item is not owned';end if;
 if c.id='hostel_table' and exists(select 1 from room_placements p join hostel_catalog h on h.id=p.item_id where p.owner_id=u and h.placement_type='desk' and p.y>0) then raise exception 'Return the supported desk items to inventory before moving the table';end if;
 if p_action='toggle' then
  if c.id not in('hostel_fan_basic','hostel_generator_small') then raise exception 'Item has no switch';end if;
  update room_placements set active=not active,updated_at=now() where owner_id=u and item_id=c.id;
  if not found then raise exception 'Place the item first';end if;
 elsif p_data->>'anchor' is null and not(p_data ? 'x') then
  delete from room_placements where owner_id=u and item_id=c.id;
  if c.id='hostel_tv_basic' then update hostel_rooms set tv_on=false where owner_id=u;end if;
 else
  if c.placement_type='none' then raise exception 'Item cannot be placed';end if;
  r:=coalesce((p_data->>'rotation')::integer,0);
  if r<0 or r>=360 or r%45<>0 then raise exception 'Invalid rotation';end if;
  if p_data ? 'x' then px:=(p_data->>'x')::numeric;py:=(p_data->>'y')::numeric;pz:=(p_data->>'z')::numeric;
  else
   -- Old clients may still send anchor-only commands. Convert, then validate normally.
   a:=p_data->>'anchor';
   if split_part(a,'-',1)<>c.placement_type then raise exception 'Invalid placement anchor';end if;
   select v.x,v.y,v.z into px,py,pz from (values
    ('floor-a',-2,0,0),('floor-b',2,0,-2),('floor-c',2,0,1),('floor-d',-2,0,2),
    ('wall-a',0,1.8,-3.84),('wall-b',2.25,1.8,-3.84),('desk-a',1.75,0,-2),('desk-b',2.25,0,-2),
    ('bed-a',-2.6,.32,-2.8),('bed-b',-2.6,.32,-3.45)) v(anchor,x,y,z) where v.anchor=a;
  end if;
  if px is null or py is null or pz is null or px::text in('NaN','Infinity','-Infinity') or py::text in('NaN','Infinity','-Infinity') or pz::text in('NaN','Infinity','-Infinity') then raise exception 'Invalid coordinates';end if;
  e:=hostel_extent(c.id,r);
  if c.placement_type='wall' then
   if r<>0 or abs(px)+e[1]>3.8 or py<>1.8 or abs(pz+3.84)>.001 then raise exception 'Attach this item to the back wall';end if;
   if exists(select 1 from room_placements p join hostel_catalog h on h.id=p.item_id where p.owner_id=u and p.item_id<>c.id and h.placement_type='wall' and abs(p.x-px)<e[1]+(hostel_extent(p.item_id,p.rotation))[1]) then raise exception 'Wall space is occupied';end if;
  elsif c.placement_type='bed' then
   if r<>0 or px<>-2.6 or py<>.32 or pz<>(case when c.id='hostel_pillow' then -3.45 else -2.8 end) then raise exception 'Place bedding on the mattress';end if;
  else
   if py<>0 or abs(px)+e[1]>3.8 or abs(pz)+e[2]>3.8 then raise exception 'Keep furniture on the room floor';end if;
   if abs(px)<e[1]+.8 and pz+e[2]>2.6 then raise exception 'Keep the entrance clear';end if;
   if c.id<>'hostel_rug' then
    if abs(px+2.6)<e[1]+.625 and abs(pz+2.8)<e[2]+1 then raise exception 'Leave space for the mattress';end if;
    for other in select p.* from room_placements p join hostel_catalog h on h.id=p.item_id
      where p.owner_id=u and p.item_id<>c.id and p.item_id<>'hostel_rug' and h.placement_type not in('wall','bed') loop
     oe:=hostel_extent(other.item_id,other.rotation);
     if abs(px-other.x)<e[1]+oe[1]+.05 and abs(pz-other.z)<e[2]+oe[2]+.05 then raise exception 'That space is occupied';end if;
    end loop;
   end if;
  end if;
  insert into room_placements(owner_id,item_id,anchor,rotation,x,y,z) values(u,c.id,'free:'||c.id,r,px,py,pz)
   on conflict(owner_id,item_id) do update set anchor=excluded.anchor,rotation=excluded.rotation,x=excluded.x,y=excluded.y,z=excluded.z,updated_at=now();
 end if;
 result:=jsonb_build_object('success',true,'snapshot',hostel_snapshot(u));
 insert into hostel_receipts values(u,p_request,p_action,result);return result;
end $$;
revoke all on function hostel_extent(text,integer),hostel_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function hostel_command(text,jsonb,uuid) to authenticated;
commit;
