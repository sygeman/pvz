import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('Debug 400 Error', () => {
  let server: ChildProcess;
  const TEST_PORT = 9996;

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

  it('debug join with various payloads', async () => {
    const testCases = [
      { name: 'Short', body: { name: 'A' } },
      { name: 'Normal', body: { name: 'Player' } },
      { name: 'WithNullId', body: { name: 'Player', playerId: null } },
      { name: 'WithStringId', body: { name: 'Player', playerId: 'test-id' } },
      { name: 'EmptyName', body: { name: '' } },
      { name: 'LongName', body: { name: 'A'.repeat(25) } },
    ];

    for (const testCase of testCases) {
      const roomId = 'DBG' + Date.now() + Math.floor(Math.random() * 1000);
      
      const response = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body)
      });

      const data = await response.json();
      console.log(`${testCase.name}: ${response.status}`, data.error || 'OK');
      
      if (testCase.name === 'EmptyName' || testCase.name === 'LongName') {
        expect(response.status).toBe(400);
      } else {
        expect(response.status).toBe(200);
      }
    }
  });

  it('debug short room ID', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/room/AB/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player' })
    });

    const data = await response.json();
    console.log('Short room ID (AB):', response.status, data);
    expect(response.status).toBe(400);
  });

  it('debug valid room ID', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/room/VALID12/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Player' })
    });

    const data = await response.json();
    console.log('Valid room ID (VALID12):', response.status, data.error || 'OK');
    expect(response.status).toBe(200);
  });
});