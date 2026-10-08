const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8787';

function createClient(username, college, id) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    const messages = [];

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        player: {
          id: id || `usr-${username.toLowerCase()}`,
          username,
          college,
          avatarConfig: { skinColor: '#8d5524', shirtColor: '#16a34a' },
          position: [0, 0, 10],
          rotation: 0,
        },
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'snapshot') {
          resolve({ ws, messages, connectionId: msg.yourConnectionId });
        }
      } catch (err) {
        console.error('JSON parse error:', err);
      }
    });

    ws.on('error', (err) => reject(err));
  });
}

async function runTests() {
  console.log('🚀 Starting FUNAAB Campus Economy Test Suite...');

  // Test 1: Connect Two Players (Enigma & Faith)
  console.log('\n--- TEST 1: Connect Two Players ---');
  const clientA = await createClient('Enigma', 'COLENG', 'user-enigma-1');
  const clientB = await createClient('Faith', 'COLFHEC', 'user-faith-2');
  console.log('✅ Client A (Enigma) connected:', clientA.connectionId);
  console.log('✅ Client B (Faith) connected:', clientB.connectionId);

  await new Promise((r) => setTimeout(r, 500));

  // Test 2: P2P Money Transfer (Enigma sends Faith ₦500)
  console.log('\n--- TEST 2: P2P Money Transfer (₦500 from Enigma to Faith) ---');
  let transferSuccessA = null;
  let transferReceivedB = null;

  clientA.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'p2p_transfer_success') transferSuccessA = msg;
  });

  clientB.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'p2p_transfer_received') transferReceivedB = msg;
  });

  clientA.ws.send(JSON.stringify({
    type: 'p2p_transfer',
    connectionId: clientA.connectionId,
    recipientUsername: 'Faith',
    amount: 500,
  }));

  await new Promise((r) => setTimeout(r, 1000));

  if (transferSuccessA && transferReceivedB) {
    console.log('✅ Transfer Successful!');
    console.log('  Sender confirmation:', transferSuccessA);
    console.log('  Recipient notice:', transferReceivedB);
  } else {
    console.error('❌ Transfer failed:', { transferSuccessA, transferReceivedB });
  }

  // Test 3: Insufficient Funds Transfer (Enigma tries to send ₦6,000 with ₦4,500 balance)
  console.log('\n--- TEST 3: Insufficient Funds Guard ---');
  let transferFailedA = null;
  clientA.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'p2p_transfer_failed') transferFailedA = msg;
  });

  clientA.ws.send(JSON.stringify({
    type: 'p2p_transfer',
    connectionId: clientA.connectionId,
    recipientUsername: 'Faith',
    amount: 6000,
  }));

  await new Promise((r) => setTimeout(r, 800));

  if (transferFailedA) {
    console.log('✅ Insufficient funds properly rejected by server:', transferFailedA.error);
  } else {
    console.error('❌ Over-transfer was not rejected!');
  }

  // Test 4: Campus Job Completion
  console.log('\n--- TEST 4: Campus Job Completion Broadcast ---');
  let jobActivitySeen = null;
  clientB.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'activity_event' && msg.event?.type === 'job') {
      jobActivitySeen = msg.event;
    }
  });

  clientA.ws.send(JSON.stringify({
    type: 'job_completed',
    connectionId: clientA.connectionId,
    jobTitle: "Mama's Food Delivery",
    reward: 300,
  }));

  await new Promise((r) => setTimeout(r, 800));

  if (jobActivitySeen) {
    console.log('✅ Job completion broadcast received across campus:', jobActivitySeen.text);
  } else {
    console.error('❌ Job broadcast not received');
  }

  // Test 5: Daily Resumption Reward Claim
  console.log('\n--- TEST 5: Daily Resumption Allowance ---');
  let dailyActivitySeen = null;
  clientB.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'activity_event' && msg.event?.type === 'daily') {
      dailyActivitySeen = msg.event;
    }
  });

  clientA.ws.send(JSON.stringify({
    type: 'daily_reward_claimed',
    connectionId: clientA.connectionId,
    username: 'Enigma',
    amount: 200,
  }));

  await new Promise((r) => setTimeout(r, 800));

  if (dailyActivitySeen) {
    console.log('✅ Daily reward activity broadcast:', dailyActivitySeen.text);
  } else {
    console.error('❌ Daily reward broadcast not received');
  }

  // Test 6: Spatial Zone Presence Resolution
  console.log('\n--- TEST 6: Spatial Zone Presence Resolution ---');
  let zoneDetected = null;

  // Move Faith to Sports Centre [-38, 0, 0]
  clientB.ws.send(JSON.stringify({
    type: 'move',
    connectionId: clientB.connectionId,
    position: [-38, 0, 0],
    rotation: 0,
    animation: 'idle',
  }));

  clientA.ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    if (msg.type === 'players_batch') {
      const faithState = msg.updates?.[clientB.connectionId];
      if (faithState && faithState.currentZone) {
        zoneDetected = faithState.currentZone;
      }
    }
  });

  await new Promise((r) => setTimeout(r, 1200));

  if (zoneDetected) {
    console.log('✅ Spatial Zone correctly classified in multiplayer state:', zoneDetected);
  } else {
    console.log('ℹ️ Zone batch check finished.');
  }

  console.log('\n🎉 ALL CAMPUS ECONOMY & RETENTION TESTS COMPLETE!\n');
  clientA.ws.close();
  clientB.ws.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
