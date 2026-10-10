const WebSocket = require('ws');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const sockets = [];
  const clients = await Promise.all(
    [0, 1].map(async (i) => {
      const ws = new WebSocket('ws://127.0.0.1:8787'),
        messages = [];
      sockets.push(ws);
      ws.on('message', (d) => messages.push(JSON.parse(d)));
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      const connectionId = 'avatar_test_' + crypto.randomUUID();
      ws.send(
        JSON.stringify({
          type: 'join',
          room: 'world:funaab:main',
          player: {
            id: crypto.randomUUID(),
            connectionId,
            username: 'AvatarTest' + i,
            college: 'COLFHEC',
            avatarConfig: { shirtColor: '#15803d', skinColor: '#8d5524', hairstyle: 'braids' },
            position: [0, 0, 48],
            animation: 'idle',
          },
        }),
      );
      return { ws, messages, connectionId };
    }),
  );
  await delay(300);
  const [a, b] = clients;
  const appearance = {
    bodyType: 'feminine',
    hairstyle: 'bun',
    topStyle: 'polo',
    topColor: '#ab1234',
    bottomStyle: 'jeans',
    skinTone: '#663c28',
    hairColor: '#111111',
    bottomColor: '#223344',
    shoeStyle: 'flats',
    shoeColor: '#eeeeee',
  };
  a.ws.send(
    JSON.stringify({
      type: 'avatar_update',
      avatarConfig: appearance,
      connectionId: b.connectionId,
    }),
  );
  await delay(300);
  const event = b.messages.find(
    (m) => m.type === 'avatar_updated' && m.connectionId === a.connectionId,
  );
  assert(event, 'Remote peer receives appearance update');
  assert.equal(event.avatarConfig.hairstyle, 'bun');
  assert.equal(event.avatarConfig.topColor, '#ab1234');
  a.ws.send(
    JSON.stringify({
      type: 'move',
      position: [3, 0, 48],
      rotation: 1,
      animation: 'walk',
      avatarConfig: { hairstyle: 'fade' },
    }),
  );
  await delay(300);
  const batches = b.messages.filter((m) => m.type === 'players_batch');
  assert(batches.length);
  for (const batch of batches)
    for (const value of Object.values(batch.updates))
      assert(!('avatarConfig' in value), 'Appearance never repeats in movement packets');
  const c = new WebSocket('ws://127.0.0.1:8787');
  sockets.push(c);
  await new Promise((r) => c.once('open', r));
  const snap = new Promise((r) =>
    c.on('message', (d) => {
      const p = JSON.parse(d);
      if (p.type === 'snapshot') r(p);
    }),
  );
  c.send(
    JSON.stringify({
      type: 'join',
      player: {
        id: crypto.randomUUID(),
        connectionId: crypto.randomUUID(),
        username: 'LateJoin',
        college: 'COLENG',
        position: [0, 0, 48],
      },
    }),
  );
  assert.equal(
    (await snap).players[a.connectionId].avatarConfig.hairstyle,
    'bun',
    'Late join snapshot contains saved current appearance',
  );
  sockets.forEach((ws) => ws.close());
  console.log(
    'Avatar presence PASSED: join, update, sender authority, compact movement packets, late-join snapshot.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
