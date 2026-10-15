-- 043: Cheaper cars (top price ₦500,000) and king-size bed ₦100,000. Apply once AFTER 042 (safe to re-run).
-- Mirrors src/config/hostelItems.ts.
begin;
update public.hostel_catalog c set price=v.price from (values
 ('car_corolla',150000),('car_camry',250000),('car_lexus',380000),('car_gwagon',500000),('hostel_bed_king',100000)
) v(id,price) where c.id=v.id;
commit;
