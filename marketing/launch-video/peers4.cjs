// Staged students for the race / gym / plaza / kitchen cut.
const P = (id, name, college, position, a, animation = 'idle', rotation = 0) => ({
  id: 'peer-' + id, connectionId: 'peer-' + id, username: name, college, position, rotation, animation,
  avatarConfig: { shirtColor: a.topColor, skinColor: a.skinTone, shoeStyle: 'sneakers', shoeColor: '#eeeeea', ...a }, lastUpdated: Date.now(),
});
const F = (o) => ({ bodyType: 'feminine', ...o }), M = (o) => ({ bodyType: 'masculine', ...o });
const g = (x, z) => [128 + x, 0, -78 + z];
// Gym stations (see src/config/gym.ts)
const gym = [
  P('g1', 'Dayo', 'COLENG', g(-3, -5.6), M({ skinTone: '#3d251e', hairstyle: 'fade', topStyle: 'tank-top', topColor: '#dc2626', bottomStyle: 'shorts', bottomColor: '#111827' }), 'jog', Math.PI),
  P('g2', 'Bisi', 'COLFHEC', g(0, -5.6), F({ skinTone: '#ad7147', hairstyle: 'ponytail', topStyle: 'tank-top', topColor: '#db2777', bottomStyle: 'shorts', bottomColor: '#1f2937' }), 'jog', Math.PI),
  P('g3', 'Emeka', 'COLCOMS', g(4.5, -4.6), M({ skinTone: '#663c28', hairstyle: 'low-cut', topStyle: 'jersey', topColor: '#2563eb', bottomStyle: 'joggers', bottomColor: '#111827' }), 'lift', Math.PI),
  P('g4', 'Ola', 'COLBIOS', g(7.2, 0), M({ skinTone: '#8d5524', hairstyle: 'bald', topStyle: 'tank-top', topColor: '#f59e0b', bottomStyle: 'shorts', bottomColor: '#374151' }), 'squat', -Math.PI / 2),
  P('g5', 'Kemi', 'COLVET', g(-2.5, 4.4), F({ skinTone: '#c68c63', hairstyle: 'bun', topStyle: 't-shirt', topColor: '#16a34a', bottomStyle: 'joggers', bottomColor: '#111827' }), 'skip', 0),
];
module.exports = { peers: [...gym] };
