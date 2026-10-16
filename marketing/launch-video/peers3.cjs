// Staged students for the "More new on campus" cut: mosque, chapel.
const P = (id, name, college, position, a, animation = 'idle', rotation = 0) => ({
  id: 'peer-' + id, connectionId: 'peer-' + id, username: name, college, position, rotation, animation,
  avatarConfig: { shirtColor: a.topColor, skinColor: a.skinTone, shoeStyle: 'sandals', shoeColor: '#3b2f22', ...a }, lastUpdated: Date.now(),
});
const F = (o) => ({ bodyType: 'feminine', ...o }), M = (o) => ({ bodyType: 'masculine', ...o });
const MQ = [-62, -126], CH = [62, -125];
const mq = (x, z) => [MQ[0] + x, 0, MQ[1] + z], ch = (x, z) => [CH[0] + x, 0, CH[1] + z];
const kaftans = ['#ffffff', '#e7e5e4', '#1e3a8a', '#065f46', '#f5f5f4', '#78350f', '#ffffff', '#334155'];
const skins = ['#8d5524', '#ad7147', '#663c28', '#3d251e', '#c68c63'];
const mosque = [P('imam', 'Imam', 'COLAMRUD', mq(0, -7), M({ skinTone: '#663c28', hairstyle: 'low-cut', topStyle: 'kaftan', topColor: '#ffffff', bottomStyle: 'trousers', bottomColor: '#ffffff', headwear: 'kufi', headwearColor: '#ffffff' }), 'pray', Math.PI)];
for (let c = 0; c < 8; c++) mosque.push(P('m' + c, ['Musa', 'Yusuf', 'Ibrahim', 'Sani', 'Bello', 'Abdul', 'Kabir', 'Tunde'][c], 'COLENG', mq(-7 + c * 2, -4.6),
  M({ skinTone: skins[c % 5], hairstyle: 'low-cut', topStyle: 'kaftan', topColor: kaftans[c], bottomStyle: 'trousers', bottomColor: kaftans[c], headwear: 'kufi', headwearColor: c % 2 ? '#ffffff' : '#7f1d1d' }), 'pray', Math.PI));
for (let c = 1; c < 7; c++) mosque.push(P('w' + c, ['Aisha', 'Zainab', 'Fatima', 'Hauwa', 'Maryam', 'Amina'][c - 1], 'COLVET', mq(-7 + c * 2, -4.6 + 4 * 1.75),
  F({ skinTone: skins[(c + 2) % 5], hairstyle: 'bun', topStyle: 'gown', topColor: ['#7c3aed', '#0f766e', '#be185d', '#1d4ed8', '#a16207', '#047857'][c - 1], bottomStyle: 'long-skirt', bottomColor: '#1f2937', headwear: 'hijab', headwearColor: ['#111827', '#0f766e', '#f5f5f4', '#1d4ed8', '#78350f', '#111827'][c - 1] }), 'pray', Math.PI));
const chapel = [P('pastor', 'Pastor', 'COLBIOS', ch(0, -8.1), M({ skinTone: '#8d5524', hairstyle: 'low-cut', topStyle: 'shirt', topColor: '#111827', bottomStyle: 'trousers', bottomColor: '#111827' }), 'wave', 0)];
const pew = (r, s) => ({ x: s * 3.4, z: -3.6 + r * 1.55 });
let n = 0;
for (let r = 0; r < 5; r++) for (const s of [-1, 1]) for (const dx of [-1.1, 0, 1.1]) {
  if ((r + n) % 4 === 3) { n++; continue; }
  const p = pew(r, s), fem = n % 2 === 0;
  const top = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff', '#db2777', '#0ea5e9'][n % 8];
  chapel.push(P('c' + n, ['Grace', 'Daniel', 'Joy', 'Samuel', 'Esther', 'David', 'Blessing', 'Peter'][n % 8], 'COLFHEC', ch(p.x + dx, p.z),
    fem ? F({ skinTone: skins[n % 5], hairstyle: ['braids', 'headwrap', 'long-weave', 'bob'][n % 4], topStyle: 'gown', topColor: top, bottomStyle: 'long-skirt', bottomColor: top, shoeStyle: 'heels' })
        : M({ skinTone: skins[n % 5], hairstyle: ['fade', 'low-cut', 'short-afro'][n % 3], topStyle: 'shirt', topColor: top, bottomStyle: 'trousers', bottomColor: '#1f2937', shoeStyle: 'flats' }), 'sit', Math.PI));
  n++;
}
module.exports = { peers: [...mosque, ...chapel] };
