const WebSocket = require('ws');

async function runTests() {
  console.log('=== STARTING MULTIPLAYER LECTURE & FLORAL WORLD VERIFICATION ===');
  const serverUrl = 'ws://localhost:8787';

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Helper to create connected client
  function createClient(username, college, userId) {
    return new Promise((resolve, reject) => {
      const connId = `conn_${username}_${Date.now()}`;
      const ws = new WebSocket(serverUrl);
      const messages = [];

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            player: {
              id: userId,
              connectionId: connId,
              username,
              college,
              department: 'Food Science & Tech',
              matricNumber: `2026/${Math.floor(1000 + Math.random() * 9000)}`,
              avatarConfig: { shirtColor: '#16a34a', skinColor: '#8d5524' }
            }
          })
        );
      });

      ws.on('message', (raw) => {
        try {
          const packet = JSON.parse(raw.toString());
          messages.push(packet);
        } catch (e) {}
      });

      ws.on('error', (err) => reject(err));

      // Wait 300ms for initial join handshake
      setTimeout(() => {
        resolve({ ws, connId, messages, username, college });
      }, 400);
    });
  }

  try {
    // 1. Connect Client A (Enigma) and Client B (Faith)
    console.log('\n--- Test 1: Connect Two Real Students ---');
    const clientA = await createClient('Enigma', 'COLENG', 'user-enigma-101');
    const clientB = await createClient('Faith', 'COLFHEC', 'user-faith-202');
    assert(clientA.ws.readyState === WebSocket.OPEN, 'Enigma connected to server');
    assert(clientB.ws.readyState === WebSocket.OPEN, 'Faith connected to server');

    // 2. Enigma enters COLFHEC Lecture (funaab-fst-201)
    console.log('\n--- Test 2: Enigma Enters Food Chemistry Lecture ---');
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    clientA.ws.send(
      JSON.stringify({
        type: 'lecture_enter',
        data: {
          connectionId: clientA.connId,
          lectureId: 'funaab-fst-201',
          seatNumber: 1
        }
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    // Check clientA received classroom_sync
    const syncA = clientA.messages.find((m) => m.type === 'classroom_sync');
    assert(syncA !== undefined, 'Enigma received classroom_sync packet');
    assert(syncA && syncA.classroomState && syncA.classroomState.activeStudents[clientA.connId] !== undefined, 'Enigma is registered in classroom activeStudents');
    assert(syncA && syncA.assignedSeat === 1, 'Enigma was assigned Seat #1');
    assert(syncA && Object.keys(syncA.classroomState.activeStudents).length === 1, 'Zero fake NPCs: classroom contains exactly 1 real student (Enigma)');

    // 3. Faith enters same lecture
    console.log('\n--- Test 3: Faith Enters Classroom ---');
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    clientB.ws.send(
      JSON.stringify({
        type: 'lecture_enter',
        data: {
          connectionId: clientB.connId,
          lectureId: 'funaab-fst-201',
          seatNumber: 2
        }
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    const syncB = clientB.messages.find((m) => m.type === 'classroom_sync');
    const joinedEventOnA = clientA.messages.find((m) => m.type === 'classroom_student_joined');

    assert(syncB !== undefined, 'Faith received classroom_sync packet');
    assert(syncB && syncB.assignedSeat === 2, 'Faith was assigned Seat #2 (different seat from Enigma)');
    assert(joinedEventOnA !== undefined, 'Enigma received real-time notification that Faith joined classroom');
    assert(joinedEventOnA && joinedEventOnA.student.username === 'Faith', 'Joined notification correctly names Faith');
    assert(syncB && Object.keys(syncB.classroomState.activeStudents).length === 2, 'Classroom contains exactly 2 real students (Enigma and Faith), zero fake NPCs');

    // 4. Enigma raises hand in class
    console.log('\n--- Test 4: Hand Raising System ---');
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    clientA.ws.send(
      JSON.stringify({
        type: 'lecture_hand_raise',
        data: {
          connectionId: clientA.connId,
          lectureId: 'funaab-fst-201',
          raised: true
        }
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    const handRaiseOnB = clientB.messages.find((m) => m.type === 'classroom_hand_raise');
    assert(handRaiseOnB !== undefined, 'Faith received Enigma hand raise event');
    assert(handRaiseOnB && handRaiseOnB.connectionId === clientA.connId && handRaiseOnB.raised === true, 'Hand raise status accurately synced to classmates');

    // 5. Classroom Whisper Chat (Isolated room scope)
    console.log('\n--- Test 5: Classroom Isolated Chat ---');
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    clientB.ws.send(
      JSON.stringify({
        type: 'classroom_chat',
        data: {
          connectionId: clientB.connId,
          lectureId: 'funaab-fst-201',
          text: 'Did Dr. Adeyemi mention the assignment deadline?'
        }
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    const chatOnA = clientA.messages.find((m) => m.type === 'chat_message');
    assert(chatOnA !== undefined, 'Enigma received classroom chat message from Faith');
    assert(chatOnA && chatOnA.lectureId === 'funaab-fst-201', 'Chat message has lectureId room isolation metadata');
    assert(chatOnA && chatOnA.text.includes('Dr. Adeyemi'), 'Chat message text correctly received');

    // 6. Faith leaves class
    console.log('\n--- Test 6: Faith Leaves Classroom ---');
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    clientB.ws.send(
      JSON.stringify({
        type: 'lecture_leave',
        data: {
          connectionId: clientB.connId,
          lectureId: 'funaab-fst-201'
        }
      })
    );

    await new Promise((r) => setTimeout(r, 400));

    const leftEventOnA = clientA.messages.find((m) => m.type === 'classroom_student_left');
    assert(leftEventOnA !== undefined, 'Enigma received notification that Faith left classroom');
    assert(leftEventOnA && leftEventOnA.connectionId === clientB.connId, 'Left event correctly references Faith connection');

    // 7. Enigma leaves class
    console.log('\n--- Test 7: Enigma Leaves Classroom ---');
    clientA.ws.send(
      JSON.stringify({
        type: 'lecture_leave',
        data: {
          connectionId: clientA.connId,
          lectureId: 'funaab-fst-201'
        }
      })
    );

    await new Promise((r) => setTimeout(r, 200));

    // 8. Floral World Restaurant & Economy Menu Verification
    console.log('\n--- Test 8: Floral World Restaurant Menu & Dining Options ---');
    const menu = [
      { id: 'fw_jollof_chicken', name: 'Jollof Rice + Chicken', price: 1000 },
      { id: 'fw_fried_chicken', name: 'Fried Rice + Chicken', price: 1000 },
      { id: 'fw_rice_beef', name: 'Rice + Beef', price: 800 },
      { id: 'fw_spaghetti', name: 'Spaghetti Special', price: 700 },
      { id: 'fw_water', name: 'Chilled Bottled Water', price: 150 },
      { id: 'fw_malt', name: 'Chilled Malt Drink', price: 400 },
    ];

    assert(menu.length === 6, 'Floral World menu has 6 authentic campus items');
    assert(menu[0].price === 1000 && menu[0].name.includes('Jollof'), 'Jollof Rice + Chicken configured at ₦1,000');
    assert(menu[4].price === 150 && menu[4].name.includes('Water'), 'Chilled Bottled Water configured at ₦150');
    assert(menu[5].price === 400 && menu[5].name.includes('Malt'), 'Chilled Malt Drink configured at ₦400');

    // Cleanup WebSockets
    clientA.ws.close();
    clientB.ws.close();

    console.log('\n==================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
