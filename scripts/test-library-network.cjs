const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { WebSocket } = require("ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "--input-type=module",
    "--eval",
    `let now=Date.parse('2026-10-12T09:00:00Z'); Date.now=()=>now; process.on('message',v=>now=Date.parse(v)); await import('./server/index.ts');`,
  ],
  {
    env: { ...process.env, PORT: "8789" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  },
);
const sockets = [];
function join(id, room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:8789");
    sockets.push(ws);
    const packets = [];
    const timer = setTimeout(
      () => reject(new Error("Join timeout " + id)),
      5000,
    );
    ws.on("error", reject);
    ws.on("open", () =>
      ws.send(
        JSON.stringify({
          type: "join",
          room,
          player: {
            id,
            connectionId: id,
            username: id,
            college: "COLFHEC",
            position: [0, 0, 9],
          },
        }),
      ),
    );
    ws.on("message", (raw) => {
      const p = JSON.parse(raw);
      packets.push(p);
      if (p.type === "snapshot") {
        clearTimeout(timer);
        resolve({ ws, packets });
      }
    });
    ws.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ws, packets, code });
    });
  });
}
(async () => {
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("Server startup timed out")),
      60000,
    );
    child.stdout.on("data", (b) => {
      if (b.toString().includes("running on")) {
        clearTimeout(t);
        resolve();
      }
    });
    child.stderr.on("data", (b) => console.error(b.toString()));
  });
  const campus = await join("campus", "world:funaab:main");
  const a = await join("reader-a", "world:funaab:library");
  const b = await join("reader-b", "world:funaab:library");
  assert.deepEqual(Object.keys(b.packets[0].players).sort(), [
    "reader-a",
    "reader-b",
  ]);
  a.ws.send(JSON.stringify({ type: "chat", text: "Study group here" }));
  a.ws.send(
    JSON.stringify({
      type: "move",
      connectionId: "reader-a",
      position: [1, 0, 6],
      rotation: 1,
      animation: "walk",
    }),
  );
  await sleep(400);
  assert(
    b.packets.some(
      (p) => p.type === "chat_message" && p.text === "Study group here",
    ),
  );
  assert(
    !campus.packets.some(
      (p) => p.type === "chat_message" && p.text === "Study group here",
    ),
  );
  assert(!campus.packets.some((p) => p.updates?.["reader-a"]));
  assert(b.packets.some((p) => p.updates?.["reader-a"]?.position[0] === 1));
  assert(!b.packets.some((p) => p.updates?.campus));
  const closed = new Promise((resolve) =>
    a.ws.on("close", (code) => resolve(code)),
  );
  child.send("2026-10-12T16:00:00Z");
  assert.equal(await closed, 1008);
  const late = await join("late-reader", "world:funaab:library");
  assert.equal(late.code, 1008);
  console.log(
    "PASS: shared library presence, movement, isolated chat/snapshots, server closure and admission.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const ws of sockets) ws.close();
    child.kill();
  });
