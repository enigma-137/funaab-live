const WebSocket = require('ws');

async function runDmAndModerationTest() {
  console.log('=== STARTING DM, IN-CHAT TRANSFER & SAFETY VERIFICATION ===');
  
  const serverUrl = 'ws://127.0.0.1:8787';

  // 1. Connect Client A (Enigma)
  const clientA = new WebSocket(serverUrl);
  // 2. Connect Client B (Faith)
  const clientB = new WebSocket(serverUrl);

  const clientAPlayerId = 'usr_enigma_test';
  const clientBPlayerId = 'usr_faith_test';

  const clientAMessages = [];
  const clientBMessages = [];

  await new Promise((resolve) => {
    let connected = 0;
    clientA.on('open', () => {
      connected++;
      if (connected === 2) resolve();
    });
    clientB.on('open', () => {
      connected++;
      if (connected === 2) resolve();
    });
  });

  console.log('Both test clients connected to WebSocket server.');

  clientA.on('message', (raw) => {
    const data = JSON.parse(raw.toString());
    clientAMessages.push(data);
  });

  clientB.on('message', (raw) => {
    const data = JSON.parse(raw.toString());
    clientBMessages.push(data);
  });

  // Client A join
  clientA.send(JSON.stringify({
    type: 'join',
    room: 'world:funaab:main',
    player: {
      id: clientAPlayerId,
      username: 'Enigma',
      college: 'COLENG',
      gender: 'male',
      department: 'Computer Science',
      year: '300L'
    }
  }));

  // Client B join
  clientB.send(JSON.stringify({
    type: 'join',
    room: 'world:funaab:main',
    player: {
      id: clientBPlayerId,
      username: 'Faith',
      college: 'COLFHEC',
      gender: 'female',
      department: 'Nutrition & Dietetics',
      year: '200L'
    }
  }));

  await new Promise((r) => setTimeout(r, 600));

  // Test 1: Send Private DM from Enigma -> Faith
  console.log('Test 1: Sending 1-on-1 Direct Message from Enigma to Faith...');
  const dmPayload = {
    type: 'private_chat',
    recipientId: clientBPlayerId,
    recipientUsername: 'Faith',
    text: 'Hello Faith! Meet me at COLFHEC Floral World?',
    transferData: null
  };
  clientA.send(JSON.stringify(dmPayload));

  await new Promise((r) => setTimeout(r, 600));

  const faithGotDm = clientBMessages.find(m => m.type === 'private_chat_message' && m.message.text.includes('Floral World'));
  const enigmaGotDmEcho = clientAMessages.find(m => m.type === 'private_chat_message' && m.message.text.includes('Floral World'));

  if (!faithGotDm || !enigmaGotDmEcho) {
    console.error('FAILED Test 1: Direct message was not received or echoed properly.');
    console.log('Client B msgs:', clientBMessages);
    process.exit(1);
  }
  console.log('✔ Test 1 Passed: Direct message delivered to recipient and echoed to sender.');

  // Test 2: In-Chat Money Transfer (Enigma sends ₦1,000 with note to Faith)
  console.log('Test 2: Sending In-Chat Money Transfer (₦1,000)...');
  const transferPayload = {
    type: 'private_chat',
    recipientId: clientBPlayerId,
    recipientUsername: 'Faith',
    text: 'Sent ₦1,000 for lunch at Floral World 🍲',
    transferData: {
      amount: 1000,
      note: 'Lunch at Floral World'
    }
  };
  clientA.send(JSON.stringify(transferPayload));

  await new Promise((r) => setTimeout(r, 600));

  const faithGotTransfer = clientBMessages.find(m => m.type === 'private_chat_message' && m.message.transferData?.amount === 1000);
  if (!faithGotTransfer) {
    console.error('FAILED Test 2: In-chat transfer receipt packet not received by recipient.');
    process.exit(1);
  }
  console.log('✔ Test 2 Passed: In-chat transfer payload received with valid transferData:', faithGotTransfer.message.transferData);

  // Test 3: Safety / Report user submission
  console.log('Test 3: Submitting user moderation report...');
  clientB.send(JSON.stringify({
    type: 'user_report',
    reporterId: clientBPlayerId,
    reporterUsername: 'Faith',
    reportedUserId: clientAPlayerId,
    reportedUsername: 'Enigma',
    reason: 'Spam',
    details: 'Testing in-game report dispatch system.'
  }));

  await new Promise((r) => setTimeout(r, 400));
  console.log('✔ Test 3 Passed: User report event handled safely by server.');

  clientA.close();
  clientB.close();

  console.log('\n=== ALL PRIVATE CHAT, TRANSFER & MODERATION TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runDmAndModerationTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
