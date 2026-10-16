-- 040: Cheaper food and drinks after the ×10 rescale. Apply once AFTER 039 (safe to re-run).
-- Meals ₦3,000–₦4,000, water ₦200, malt ₦600 at Floral World and the food court; Arena bar ₦500–₦1,500.
-- Mirrors src/config/economy.ts (menus) and src/config/foodVendors.ts (Arena bar).
begin;
update public.campus_food_menu m set price=v.price from (values
 ('fw_jollof_chicken',4000),('fw_fried_chicken',4000),('fw_rice_beef',3500),('fw_spaghetti',3000),('fw_water',200),('fw_malt',600),
 ('jollof_chicken',4000),('shawarma_beef',4000),('suya_spicy',3000),('cold_water',200),('malt_drink',600)
) v(id,price) where m.id=v.id;
update public.food_vendor_items i set price=v.price from (values
 ('vendor_party_zobo',800),('vendor_party_soda',500),('vendor_party_malt',800),('vendor_party_chapman',1500),('vendor_party_energy',1200)
) v(id,price) where i.id=v.id;
commit;
