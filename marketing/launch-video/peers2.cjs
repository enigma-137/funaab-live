// Staged students for the "What's new" cut.
const P = (id, name, college, position, a, animation = 'idle', rotation = 0) => ({
  id: 'peer-' + id, connectionId: 'peer-' + id, username: name, college, position, rotation, animation,
  avatarConfig: { shirtColor: a.topColor, skinColor: a.skinTone, shoeStyle: 'sneakers', shoeColor: '#eeeeea', ...a }, lastUpdated: Date.now(),
});
const F = (o) => ({ bodyType: 'feminine', ...o }), M = (o) => ({ bodyType: 'masculine', ...o });
const JUMP = { topStyle: 'jumpsuit', topColor: '#2f6b2f', bottomStyle: 'trousers', bottomColor: '#2f6b2f', shoeStyle: 'boots', shoeColor: '#3b2f22' };
// Arena dance floor centre [130.5, 0, -45]
const arena = [
  P('a1', 'Tolu', 'COLFHEC', [129, 0, -46.5], F({ skinTone: '#ad7147', hairstyle: 'braids', topStyle: 'gown', topColor: '#db2777', bottomStyle: 'long-skirt', bottomColor: '#db2777', shoeStyle: 'heels' }), 'dance', 1.2),
  P('a2', 'Chidi', 'COLENG', [132, 0, -46], M({ skinTone: '#8d5524', hairstyle: 'locs', topStyle: 'tank-top', topColor: '#f59e0b', bottomStyle: 'jeans', bottomColor: '#1f2937' }), 'dance', -1.4),
  P('a3', 'Aisha', 'COLVET', [130.5, 0, -43.2], F({ skinTone: '#663c28', hairstyle: 'big-afro', topStyle: 'blouse', topColor: '#7c3aed', bottomStyle: 'skirt', bottomColor: '#111827' }), 'dance', 3.0),
  P('a4', 'Bolu', 'COLANIM', [128.5, 0, -43.8], M({ skinTone: '#3d251e', hairstyle: 'cornrows', topStyle: 'jacket', topColor: '#0ea5e9', bottomStyle: 'trousers', bottomColor: '#374151' }), 'cheer', 2.2),
  P('a5', 'Zainab', 'COLPLANT', [132.6, 0, -43.6], F({ skinTone: '#c68c63', hairstyle: 'headwrap', topStyle: 'kaftan', topColor: '#16a34a', bottomStyle: 'long-skirt', bottomColor: '#14532d', shoeStyle: 'sandals' }), 'dance', -2.4),
  P('a6', 'Kunle', 'COLERM', [131.5, 0, -47.6], M({ skinTone: '#ad7147', hairstyle: 'short-afro', topStyle: 'shirt', topColor: '#ffffff', bottomStyle: 'jeans', bottomColor: '#1e3a8a' }), 'dance', 0.4),
];
// FPY farm plots: plant [120.5,0,31], water [127,0,47], harvest [133.5,0,36]
const farm = [
  P('f1', 'Segun', 'COLPLANT', [121, 0, 32], M({ skinTone: '#8d5524', hairstyle: 'low-cut', ...JUMP }), 'idle', 0.6),
  P('f2', 'Ngozi', 'COLANIM', [126.5, 0, 46], F({ skinTone: '#ad7147', hairstyle: 'bun', ...JUMP }), 'idle', 2.8),
  P('f3', 'Ibrahim', 'COLAMRUD', [133, 0, 36.5], M({ skinTone: '#663c28', hairstyle: 'short-afro', ...JUMP }), 'idle', -1.6),
  P('f4', 'Funmi', 'COLERM', [124, 0, 38], F({ skinTone: '#c68c63', hairstyle: 'ponytail', ...JUMP }), 'walk', 1.5),
];
// Courts [-100,0,31]
const courts = [
  P('c1', 'Dayo', 'COLENG', [-106, 0, 30], M({ skinTone: '#3d251e', hairstyle: 'fade', topStyle: 'jersey', topColor: '#dc2626', bottomStyle: 'shorts', bottomColor: '#dc2626' }), 'run', 1.5),
  P('c2', 'Ola', 'COLBIOS', [-101, 0, 28], M({ skinTone: '#8d5524', hairstyle: 'bald', topStyle: 'jersey', topColor: '#2563eb', bottomStyle: 'shorts', bottomColor: '#2563eb' }), 'cheer', -1.5),
  P('c3', 'Bisi', 'COLFHEC', [-96, 0, 33], F({ skinTone: '#ad7147', hairstyle: 'ponytail', topStyle: 'jersey', topColor: '#facc15', bottomStyle: 'shorts', bottomColor: '#111827' }), 'run', -0.5),
  P('c4', 'Emeka', 'COLCOMS', [-93, 0, 29], M({ skinTone: '#663c28', hairstyle: 'locs', topStyle: 'jersey', topColor: '#facc15', bottomStyle: 'shorts', bottomColor: '#111827' }), 'wave', -2),
];
module.exports = { peers: [...arena, ...farm, ...courts] };
