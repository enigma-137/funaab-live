-- 041: Lifestyle shop. Apply once AFTER 040 (safe to re-run).
-- Room: double and king-size bed frames (on the mattress spot, one at a time), split AC (back wall),
-- double-door fridge, laptop (on a table). Fashion: watches and bags, worn on the avatar.
-- Cars: owned now, driven when the estate opens. Mirrors src/config/hostelItems.ts.
begin;

insert into public.hostel_catalog(id,name,category,price,placement_type,credit,consumable) values
 ('hostel_bed_double','Double Bed','Room',60000,'bed',false,false),
 ('hostel_bed_king','King-size Bed','Room',180000,'bed',false,false),
 ('hostel_ac','Split Air Conditioner','Appliances',150000,'wall',false,false),
 ('hostel_fridge_big','Double-door Fridge','Appliances',95000,'floor',false,false),
 ('hostel_laptop','Laptop','Entertainment',85000,'desk',false,false),
 ('fashion_watch_casio','Casio Wristwatch','Fashion',15000,'none',false,false),
 ('fashion_watch_smart','Smartwatch','Fashion',45000,'none',false,false),
 ('fashion_watch_gold','Gold Wristwatch','Fashion',120000,'none',false,false),
 ('fashion_bag_backpack','School Backpack','Fashion',12000,'none',false,false),
 ('fashion_bag_handbag','Leather Handbag','Fashion',35000,'none',false,false),
 ('fashion_bag_designer','Designer Bag','Fashion',150000,'none',false,false),
 ('car_corolla','Toyota Corolla (Tokunbo)','Cars',450000,'none',false,false),
 ('car_camry','Toyota Camry','Cars',750000,'none',false,false),
 ('car_lexus','Lexus RX 350','Cars',1500000,'none',false,false),
 ('car_gwagon','Mercedes G-Wagon','Cars',4000000,'none',false,false)
-- Re-running never undoes later price changes (043).
on conflict(id) do nothing;

-- Function edits, applied only if not already there (so the file can be re-run).
create or replace function pg_temp.patch041(p_fn text, p_old text, p_new text) returns void language plpgsql as $$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
 if position(p_new in d)>0 then return; end if;
 if (length(d)-length(replace(d,p_old,'')))/length(p_old)<>1 then raise exception '041: % does not contain "%" exactly once',p_fn,p_old; end if;
 execute replace(d,p_old,p_new);
end $$;

-- Footprints (kept in parity with the client).
select pg_temp.patch041('public.hostel_extent(text,integer)',
 '(''hostel_microwave'',array[.5,.4])) t(id,dims)',
 '(''hostel_microwave'',array[.5,.4]),(''hostel_bed_double'',array[1.45,2.15]),(''hostel_bed_king'',array[1.6,2.25]),(''hostel_ac'',array[.9,.25]),(''hostel_fridge_big'',array[.85,.7]),(''hostel_laptop'',array[.36,.26])) t(id,dims)');
-- New switches.
select pg_temp.patch041('public.hostel_command(text,jsonb,uuid)',
 '''hostel_fridge'',''hostel_led_strip'') then raise exception ''Item has no switch''',
 '''hostel_fridge'',''hostel_led_strip'',''hostel_ac'',''hostel_fridge_big'',''hostel_laptop'') then raise exception ''Item has no switch''');
-- One bed frame on the mattress at a time.
select pg_temp.patch041('public.hostel_command(text,jsonb,uuid)',
 'then raise exception ''Place bedding on the mattress''; end if;',
 'then raise exception ''Place bedding on the mattress''; end if;
    if c.id in(''hostel_bed_double'',''hostel_bed_king'') and exists(select 1 from room_placements p where p.owner_id=u and p.item_id<>c.id and p.item_id in(''hostel_bed_double'',''hostel_bed_king'')) then raise exception ''Take the other bed frame out first''; end if;');
commit;
