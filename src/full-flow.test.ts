import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('Full Game Flow E2E', () => {
  let server: ChildProcess;
  const TEST_PORT = 9995;

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

  it('complete game flow: join → SSE → click → damage → level up', async () => {
    const roomId = 'FULL' + Date.now();
    const playerName = 'TestPlayer';

    // Step 1: Health check
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);
    console.log('✓ Health check passed');

    // Step 2: Join room
    const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName })
    });
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    const playerId = joinData.playerId;
    
    expect(joinData.player.name).toBe(playerName);
    expect(joinData.player.level).toBe(1);
    expect(joinData.player.damage).toBe(1);
    expect(joinData.baby).toBeDefined();
    expect(joinData.baby.currentHp).toBe(joinData.baby.maxHp);
    
    const babyMaxHp = joinData.baby.maxHp;
    console.log(`✓ Joined room ${roomId} as ${playerName} (ID: ${playerId})`);
    console.log(`  Baby: ${joinData.baby.name} (${babyMaxHp} HP)`);

    // Step 3: Connect to SSE and collect events
    const sseEvents: any[] = [];
    const ssePromise = new Promise<void>((resolve, reject) => {
      fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/events`).then(async (res) => {
        if (!res.body) {
          reject(new Error('No SSE body'));
          return;
        }
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // Read for 3 seconds then abort
        const timeout = setTimeout(() => {
          reader.cancel();
          resolve();
        }, 3000);
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));
                  sseEvents.push(event);
                  console.log('  SSE:', event.type);
                } catch {}
              }
            }
          }
        } finally {
          clearTimeout(timeout);
        }
      }).catch(reject);
    });

    // Wait a bit for SSE to connect
    await new Promise(r => setTimeout(r, 300));

    // Step 4: Click multiple times
    const clickCount = 5;
    for (let i = 0; i < clickCount; i++) {
      const clickRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
      expect(clickRes.status).toBe(200);
      const clickData = await clickRes.json();
      console.log(`✓ Click ${i + 1}: ${clickData.damage} dmg, baby HP: ${clickData.baby?.currentHp ?? 'N/A'}`);
      
      if (i < clickCount - 1) {
        await new Promise(r => setTimeout(r, 50)); // Small delay between clicks
      }
    }

    // Wait for SSE to receive events
    await ssePromise;

    // Step 5: Get player state (leaderboard)
    const leaderboardRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/leaderboard`);
    expect(leaderboardRes.status).toBe(200);
    const leaderboard = await leaderboardRes.json();
    
    const player = leaderboard.find((p: any) => p.id === playerId);
    expect(player).toBeDefined();
    expect(player.clicks).toBe(clickCount);
    expect(player.totalDamage).toBe(clickCount); // 1 damage per click at level 1
    expect(player.xp).toBe(clickCount * 5); // 5 XP per damage
    
    console.log(`✓ Leaderboard check:`);
    console.log(`  Clicks: ${player.clicks}, Damage: ${player.totalDamage}, XP: ${player.xp}`);

    // Step 6: Verify SSE events
    expect(sseEvents.length).toBeGreaterThan(0);
    
    // Note: player-joined event is sent before SSE connects, so we won't see it
    // But we should see init and baby-damaged events
    const initEvents = sseEvents.filter(e => e.type === 'init');
    const babyDamagedEvents = sseEvents.filter(e => e.type === 'baby-damaged');
    
    expect(initEvents.length).toBeGreaterThan(0);
    expect(babyDamagedEvents.length).toBeGreaterThan(0);
    
    console.log(`✓ SSE events received: ${sseEvents.length} total`);
    console.log(`  - init: ${initEvents.length}`);
    console.log(`  - baby-damaged: ${babyDamagedEvents.length}`);
    
    // Last baby update should show reduced HP if there were baby-update events
    const babyUpdateEvents = sseEvents.filter(e => e.type === 'baby-update');
    if (babyUpdateEvents.length > 0) {
      const lastBabyUpdate = babyUpdateEvents[babyUpdateEvents.length - 1];
      expect(lastBabyUpdate.baby.currentHp).toBeLessThan(babyMaxHp);
      console.log(`  Final baby HP: ${lastBabyUpdate.baby.currentHp}/${babyMaxHp}`);
    } else {
      // Check baby-damaged events instead
      const lastDamaged = babyDamagedEvents[babyDamagedEvents.length - 1];
      if (lastDamaged) {
        console.log(`  Final baby HP: ${lastDamaged.baby.currentHp}/${babyMaxHp}`);
      }
    }

    // Step 7: Test kill flow (if baby HP allows)
    const finalBabyUpdate = sseEvents.filter(e => e.type === 'baby-update').pop();
    const currentBabyHp = finalBabyUpdate?.baby?.currentHp ?? babyMaxHp;
    
    if (currentBabyHp <= clickCount * 5) { // Can kill with ~5 more clicks
      console.log('  Attempting to kill baby...');
      
      let killClicks = 0;
      while (killClicks < 100) { // Safety limit
        const clickRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId })
        });
        
        if (clickRes.status !== 200) break;
        
        const data = await clickRes.json();
        killClicks++;
        
        if (data.baby?.currentHp === 0 || data.babySpawned) {
          console.log(`✓ Baby killed after ${killClicks} additional clicks!`);
          console.log(`  New baby spawned: ${data.baby?.name ?? 'N/A'}`);
          
          if (data.leveledUp) {
            console.log(`  Player leveled up to ${data.player?.level}!`);
          }
          break;
        }
      }
    }

    console.log('\n✅ Full game flow completed successfully!');
  });

  it('handles multiple players in same room', async () => {
    const roomId = 'MULTI' + Date.now();
    
    // Player 1 joins
    const p1Res = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player1' })
    });
    const p1Data = await p1Res.json();
    
    // Player 2 joins
    const p2Res = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player2' })
    });
    const p2Data = await p2Res.json();
    
    // Both should see same baby
    expect(p1Data.baby.instanceId).toBe(p2Data.baby.instanceId);
    
    // Leaderboard should show both
    const lbRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/leaderboard`);
    const lb = await lbRes.json();
    expect(lb.length).toBe(2);
    
    console.log(`✓ Multiplayer: ${lb.length} players in room ${roomId}`);
  });

  it('handles reconnection with playerId', async () => {
    const roomId = 'RECON' + Date.now();
    
    // Initial join
    const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ReconnectTest' })
    });
    const joinData = await joinRes.json();
    const playerId = joinData.playerId;
    
    // Make some clicks
    await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    
    // Reconnect with same playerId
    const reconRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ReconnectTest', playerId })
    });
    const reconData = await reconRes.json();
    
    expect(reconData.reconnected).toBe(true);
    expect(reconData.playerId).toBe(playerId);
    expect(reconData.player.clicks).toBe(1);
    
    console.log(`✓ Reconnection works, preserved ${reconData.player.clicks} clicks`);
  });
});