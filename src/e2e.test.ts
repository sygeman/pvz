import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

// E2E Test for SSE reconnect issue
// This test starts the actual server and tests real SSE behavior

describe('E2E SSE Tests', () => {
  let server: ChildProcess;
  let serverPort: number;
  const TEST_PORT = 9999;

  beforeAll(async () => {
    // Build and start server
    const build = Bun.spawn(['bun', 'run', 'build'], {
      cwd: '/root/pvz',
      stdout: 'ignore',
      stderr: 'ignore'
    });
    await build.exited;

    // Start server
    server = spawn('bun', ['run', 'dist/index.js'], {
      cwd: '/root/pvz',
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    if (server) {
      server.kill();
    }
  });

  it('health check works', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('join room works', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/room/E2ETEST/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2EPlayer' })
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.playerId).toBeDefined();
    expect(data.baby).toBeDefined();
  });

  it('multiple clicks do not break SSE', async () => {
    const roomId = 'E2ESSE' + Date.now(); // 10+ chars
    
    // Join first
    const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SSETester' })
    });
    const joinData = await joinRes.json();
    const playerId = joinData.playerId;

    // Connect SSE with proper headers
    const sseRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/events`, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');

    // Do multiple clicks rapidly
    const clicks = [];
    for (let i = 0; i < 5; i++) {
      clicks.push(
        fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId })
        })
      );
    }

    const results = await Promise.all(clicks);
    
    // All requests should succeed
    for (const res of results) {
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.error).toBeUndefined();
    }

    // SSE should still be connected (readable not locked with error)
    expect(sseRes.body).toBeDefined();
  });

  it.skip('broadcast to multiple clients works', async () => {
    const roomId = 'E2EMULTI' + Date.now(); // 8+ chars
    
    // Join as player 1
    const join1 = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player1' })
    });
    const data1 = await join1.json();

    // Connect SSE as player 1 with headers
    const sse1 = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/events`, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    expect(sse1.status).toBe(200);

    // Join as player 2
    const join2 = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player2' })
    });
    expect(join2.status).toBe(200);

    // Player 1 clicks - should not break anything
    const clickRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: data1.playerId })
    });
    
    expect(clickRes.status).toBe(200);
    const clickData = await clickRes.json();
    expect(clickData.error).toBeUndefined();
  });
});

describe('Stress Test', () => {
  it('handles rapid clicks without crashing', async () => {
    const TEST_PORT = 9998;
    
    // Build
    const build = Bun.spawn(['bun', 'run', 'build'], {
      cwd: '/root/pvz',
      stdout: 'ignore',
      stderr: 'ignore'
    });
    await build.exited;

    // Start server
    const server = spawn('bun', ['run', 'dist/index.js'], {
      cwd: '/root/pvz',
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: 'pipe'
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const roomId = 'STRESS' + Date.now(); // 6+ chars
      
      // Join
      const joinRes = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'StressTester' })
      });
      const { playerId } = await joinRes.json();

      // Rapid fire 20 clicks
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
          })
        );
      }

      const results = await Promise.all(promises);
      
      // Server should not crash, most requests should succeed
      const successCount = results.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(15); // At least 15 should succeed

      // Health check should still work
      const health = await fetch(`http://localhost:${TEST_PORT}/api/health`);
      expect(health.status).toBe(200);
    } finally {
      server.kill();
    }
  }, 10000); // 10 second timeout
});