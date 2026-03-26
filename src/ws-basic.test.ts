import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('WebSocket Basic Test', () => {
  let server: ChildProcess;
  const TEST_PORT = 9993;

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

  it('connects and receives init', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/room/TEST123`);
    const messages: any[] = [];
    
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        console.log('[WS] Message:', event.data);
        try {
          const data = JSON.parse(event.data);
          messages.push(data);
          if (data.type === 'init') {
            resolve();
          }
        } catch (e) {
          console.log('[WS] Parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.log('[WS] Error:', err);
        reject(err);
      };

      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe('init');
    expect(messages[0].clientId).toBeDefined();
    expect(messages[0].baby).toBeDefined();

    ws.close();
    console.log('✓ WebSocket init received');
  });

  it('joins via WebSocket', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/room/JOIN123`);
    const messages: any[] = [];
    
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        console.log('[WS] Connected, sending join...');
        ws.send(JSON.stringify({ type: 'join', name: 'TestPlayer' }));
      };

      ws.onmessage = (event) => {
        console.log('[WS] Message:', event.data);
        try {
          const data = JSON.parse(event.data);
          messages.push(data);
          if (data.type === 'joined') {
            resolve();
          }
        } catch {}
      };

      ws.onerror = reject;
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const joined = messages.find(m => m.type === 'joined');
    expect(joined).toBeDefined();
    expect(joined.player.name).toBe('TestPlayer');

    ws.close();
    console.log('✓ WebSocket join working');
  });

  it('clicks via WebSocket', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws/room/CLICK123`);
    const messages: any[] = [];
    let playerId: string;
    
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', name: 'Clicker' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          messages.push(data);
          
          if (data.type === 'joined') {
            playerId = data.playerId;
            // Send click after join
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'click', playerId }));
            }, 100);
          }
          
          if (data.type === 'click-result') {
            resolve();
          }
        } catch {}
      };

      ws.onerror = reject;
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const clickResult = messages.find(m => m.type === 'click-result');
    expect(clickResult).toBeDefined();
    expect(clickResult.damage).toBe(1);

    ws.close();
    console.log('✓ WebSocket click working');
  });
});