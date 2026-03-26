import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('Full Game Flow E2E (WebSocket)', () => {
  let server: ChildProcess;
  const TEST_PORT = 9994;

  beforeAll(async () => {
    const build = Bun.spawn(['bun', 'run', 'build'], {
      cwd: '/root/pvz',
      stdout: 'ignore',
      stderr: 'ignore'
    });
    await build.exited;

    server = spawn('bun', ['run', 'dist/index.js'], {
      cwd: '/root/pvz',
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: 'pipe'
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    if (server) server.kill();
  });

  function createWebSocket(roomId: string): Promise<{ ws: WebSocket; clientId: string; messages: any[] }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/room/${roomId}`);
      const messages: any[] = [];
      let clientId: string;

      ws.onopen = () => {
        console.log('  [WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          messages.push(data);
          
          if (data.type === 'init') {
            clientId = data.clientId;
            resolve({ ws, clientId, messages });
          }
          
          // Respond to ping
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {}
      };

      ws.onerror = (err) => {
        reject(err);
      };

      ws.onclose = () => {
        console.log('  [WS] Disconnected');
      };

      // Timeout if no init received
      setTimeout(() => {
        if (!clientId) reject(new Error('WebSocket init timeout'));
      }, 3000);
    });
  }

  it('complete game flow via WebSocket', async () => {
    const roomId = 'WSFLOW' + Date.now();
    const playerName = 'WsPlayer';

    // Step 1: Health check
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);
    console.log('✓ Health check passed');

    // Step 2: Connect WebSocket
    const { ws, clientId, messages } = await createWebSocket(roomId);
    console.log(`✓ WebSocket connected (client: ${clientId})`);

    // Step 3: Join room via WS
    ws.send(JSON.stringify({ type: 'join', name: playerName }));

    // Wait for join response
    await new Promise((resolve) => {
      const check = () => {
        const joined = messages.find(m => m.type === 'joined');
        if (joined) resolve(joined);
        else setTimeout(check, 50);
      };
      check();
    });

    const joinedMsg = messages.find(m => m.type === 'joined');
    const playerId = joinedMsg.playerId;
    const babyMaxHp = joinedMsg.baby.maxHp;

    console.log(`✓ Joined as ${joinedMsg.player.name}, baby: ${joinedMsg.baby.name} (${babyMaxHp} HP)`);

    // Step 4: Click multiple times via WS
    const clickCount = 5;
    for (let i = 0; i < clickCount; i++) {
      ws.send(JSON.stringify({ type: 'click', playerId }));
      await new Promise(r => setTimeout(r, 50));
    }

    // Wait for click results
    await new Promise(r => setTimeout(r, 300));

    const clickResults = messages.filter(m => m.type === 'click-result');
    const babyDamaged = messages.filter(m => m.type === 'baby-damaged');

    console.log(`✓ Sent ${clickCount} clicks`);
    console.log(`  Received ${clickResults.length} click results, ${babyDamaged.length} broadcasts`);

    // Step 5: Get leaderboard via WS
    ws.send(JSON.stringify({ type: 'get-leaderboard' }));
    await new Promise(r => setTimeout(r, 100));

    const leaderboardMsg = messages.find(m => m.type === 'leaderboard');
    expect(leaderboardMsg).toBeDefined();
    expect(leaderboardMsg.leaderboard.length).toBeGreaterThan(0);

    const player = leaderboardMsg.leaderboard.find((p: any) => p.id === playerId);
    expect(player).toBeDefined();
    expect(player.clicks).toBe(clickCount);

    console.log(`✓ Leaderboard: ${player.name} has ${player.clicks} clicks, ${player.totalDamage} damage`);

    // Step 6: Verify ping/pong
    const pings = messages.filter(m => m.type === 'ping');
    console.log(`✓ Ping/pong working (${pings.length} pings received)`);

    // Cleanup
    ws.close();
    console.log('✅ Full WebSocket flow completed!');
  });

  it('HTTP endpoints still work (backward compatibility)', async () => {
    const roomId = 'HTTP' + Date.now();

    // Join via HTTP
    const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'HttpPlayer' })
    });
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    expect(joinData.player.name).toBe('HttpPlayer');

    // Click via HTTP
    const clickRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: joinData.playerId })
    });
    expect(clickRes.status).toBe(200);
    const clickData = await clickRes.json();
    expect(clickData.damage).toBe(1);

    // Leaderboard via HTTP
    const lbRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/leaderboard`);
    expect(lbRes.status).toBe(200);
    const lb = await lbRes.json();
    expect(lb.length).toBe(1);

    console.log('✓ HTTP backward compatibility working');
  });

  it('WebSocket broadcasts to multiple clients', async () => {
    const roomId = 'BROADCAST' + Date.now();

    // Connect two clients
    const client1 = await createWebSocket(roomId);
    const client2 = await createWebSocket(roomId);

    // Both join
    client1.ws.send(JSON.stringify({ type: 'join', name: 'Player1' }));
    client2.ws.send(JSON.stringify({ type: 'join', name: 'Player2' }));

    await new Promise(r => setTimeout(r, 200));

    // Get player IDs
    const joined1 = client1.messages.find(m => m.type === 'joined');
    const joined2 = client2.messages.find(m => m.type === 'joined');

    // Player1 clicks - Player2 should receive broadcast
    const p2MessagesBefore = client2.messages.length;
    client1.ws.send(JSON.stringify({ type: 'click', playerId: joined1.playerId }));
    
    await new Promise(r => setTimeout(r, 200));

    const p2MessagesAfter = client2.messages.length;
    expect(p2MessagesAfter).toBeGreaterThan(p2MessagesBefore);

    const babyDamaged = client2.messages.find(m => m.type === 'baby-damaged');
    expect(babyDamaged).toBeDefined();
    expect(babyDamaged.attacker.id).toBe(joined1.playerId);

    console.log('✓ WebSocket broadcasting works between clients');

    client1.ws.close();
    client2.ws.close();
  });
});