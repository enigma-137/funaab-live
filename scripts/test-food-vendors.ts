// Timed food vendors — schedule helper tests at simulated Africa/Lagos times.
// Run: npm run test:vendors   (loops over several device timezones to prove they don't matter)
import assert from 'node:assert/strict';
import { FOOD_VENDORS, getVendorStatus, nextVendorTransition, vendorItem } from '../src/config/foodVendors';

// Lagos is UTC+1 with no DST: 20:00 Lagos on 12 Oct 2026 = 19:00 UTC.
const lagos = (hhmm: string, day = 12) => { const [h, m] = hhmm.split(':').map(Number); return Date.UTC(2026, 9, day, h - 1, m); };
const at = (vendor: 'mai_suya' | 'indomie_egg', hhmm: string) => getVendorStatus(vendor, lagos(hhmm));

const zones = ['Africa/Lagos', 'America/New_York', 'Asia/Tokyo', 'UTC', 'Pacific/Kiritimati'];
for (const zone of zones) {
  process.env.TZ = zone; // simulates a phone set to another timezone; results must not change
  let s;
  // Mai Suya
  s = at('mai_suya', '18:30');
  assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 PM'); assert.equal(s.nextOpensAt, lagos('19:00')); assert.equal(s.shortLabel, 'Closed · Opens 7 PM');
  s = at('mai_suya', '19:00'); assert.equal(s.isOpen, true, 'opens exactly at 19:00');
  s = at('mai_suya', '20:00');
  assert.equal(s.isOpen, true); assert.equal(s.shortLabel, 'Open until 11 PM'); assert.equal(s.label, 'Open until 11 PM'); assert.equal(s.closesAt, lagos('23:00')); assert.equal(s.currentWindow?.label, 'Night');
  s = at('mai_suya', '22:59'); assert.equal(s.isOpen, true);
  s = at('mai_suya', '23:00'); assert.equal(s.isOpen, false, 'closes exactly at 23:00');
  s = at('mai_suya', '23:15');
  assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 PM tomorrow'); assert.equal(s.nextOpensAt, lagos('19:00', 13));
  s = at('mai_suya', '00:30'); assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 PM', 'after midnight it opens "today"');

  // Indomie & Egg
  s = at('indomie_egg', '06:00'); assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 AM'); assert.equal(s.nextOpensAt, lagos('07:00'));
  s = at('indomie_egg', '08:00'); assert.equal(s.isOpen, true); assert.equal(s.label, 'Open until 11 AM'); assert.equal(s.currentWindow?.label, 'Breakfast');
  assert.equal(at('indomie_egg', '10:59').isOpen, true);
  s = at('indomie_egg', '11:01'); assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 PM'); assert.equal(s.nextOpensAt, lagos('19:00'));
  assert.equal(at('indomie_egg', '18:30').isOpen, false);
  s = at('indomie_egg', '19:30'); assert.equal(s.isOpen, true); assert.equal(s.label, 'Open until 11 PM'); assert.equal(s.currentWindow?.label, 'Evening');
  assert.equal(at('indomie_egg', '22:59').isOpen, true);
  s = at('indomie_egg', '23:01'); assert.equal(s.isOpen, false); assert.equal(s.label, 'Opens 7:00 AM tomorrow'); assert.equal(s.shortLabel, 'Closed · Opens 7 AM tomorrow'); assert.equal(s.nextOpensAt, lagos('07:00', 13));

  // Transitions: the world can schedule its next re-render exactly.
  assert.equal(nextVendorTransition(lagos('12:00')), lagos('19:00'), 'both open at 19:00');
  assert.equal(nextVendorTransition(lagos('20:00')), lagos('23:00'));
  assert.equal(nextVendorTransition(lagos('23:30')), lagos('07:00', 13), 'Indomie breakfast is next');
  assert.equal(nextVendorTransition(lagos('08:00')), lagos('11:00'));

}

// Menu is central and server-priced items match the economy rebalance (migration 012).
assert.deepEqual(FOOD_VENDORS.mai_suya.items.map((i) => [i.id, i.price]), [['vendor_suya_beef', 400], ['vendor_suya_chicken', 350]]);
assert.deepEqual(FOOD_VENDORS.indomie_egg.items.map((i) => [i.id, i.price]), [['vendor_indomie_plain', 250], ['vendor_indomie_egg', 350]]);
assert.equal(vendorItem('mai_suya', 'vendor_indomie_egg'), undefined, 'items belong to one vendor');

console.log(`FOOD VENDOR SCHEDULE PASSED under device timezones ${zones.join(', ')}: Mai Suya 18:30/19:00/20:00/22:59/23:00/23:15/00:30, Indomie 06:00/08:00/10:59/11:01/18:30/19:30/22:59/23:01, labels, exact closesAt/nextOpensAt, transitions, menu.`);
