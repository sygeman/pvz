import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('SSE Content-Type Test', () => {
  let server: ChildProcess;
  const TEST_PORT = 9997;

  beforeAll(async () => {
    // Build
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

    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(() => {
    if (server) server.kill();
  });

  it('SSE endpoint returns text/event-stream content type', async () => {
    const roomId = 'CTTEST' + Date.now();
    
    // Join first (to create room)
    await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' })
    });

    // Now test SSE endpoint
    const response = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/events`);
    
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    // THIS IS THE KEY TEST - must be text/event-stream, not text/plain
    expect(contentType).toBe('text/event-stream');
    expect(contentType).not.toBe('text/plain');
    expect(contentType).not.toContain('text/plain');
  });

  it('static files return text/html, not text/event-stream', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    
    // Should get HTML for root
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get('content-type');
    console.log('Static Content-Type:', contentType);
    
    // Should be HTML, not event-stream
    expect(contentType).toContain('text/html');
  });

  it('API endpoints return application/json, not text/event-stream', async () => {
    const roomId = 'APICT' + Date.now();
    
    const response = await fetch(`http://localhost:${TEST_PORT}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ApiTest' })
    });
    
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get('content-type');
    console.log('API Content-Type:', contentType);
    
    // Should be JSON
    expect(contentType).toContain('application/json');
  });
});