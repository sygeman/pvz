import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Room } from './types';

const BASE_URL = 'http://localhost:3458';
const TEST_ROOM = 'TEST' + Date.now();

describe.skip('API Integration Tests', () => {
  let playerId: string;

  beforeAll(async () => {
    // Start server for tests
    // Note: In real scenario, server should be running
  });

  it('health check returns ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.rooms).toBeDefined();
  });

  it('join room creates player', async () => {
    const res = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestPlayer' })
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.playerId).toBeDefined();
    expect(data.player).toBeDefined();
    expect(data.player.name).toBe('TestPlayer');
    expect(data.baby).toBeDefined();
    expect(data.baby.currentHp).toBeGreaterThan(0);
    
    playerId = data.playerId;
  });

  it('click reduces baby HP', async () => {
    // First join to get initial state
    const joinRes = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}_CLICK/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ClickTester' })
    });
    const joinData = await joinRes.json();
    const pid = joinData.playerId;
    const initialHp = joinData.baby.currentHp;

    // Click
    const res = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}_CLICK/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: pid })
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.killed).toBe(false);
    expect(data.damage).toBeGreaterThan(0);
    expect(data.baby.currentHp).toBe(initialHp - data.damage);
    expect(data.player.totalDamage).toBe(data.damage);
    expect(data.xpGained).toBe(data.damage * 5);
  });

  it('click with invalid player returns error', async () => {
    const res = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'invalid-id' })
    });
    
    expect(res.status).toBe(200); // Elysia returns 200 with error object
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('leaderboard returns sorted players', async () => {
    const res = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}/leaderboard`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('SSE endpoint returns event-stream', async () => {
    const res = await fetch(`${BASE_URL}/api/room/${TEST_ROOM}_SSE/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('join with reconnection returns existing player', async () => {
    const roomName = 'RECONNECT_' + Date.now();
    
    // First join
    const res1 = await fetch(`${BASE_URL}/api/room/${roomName}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ReconnectTest' })
    });
    const data1 = await res1.json();
    const originalId = data1.playerId;

    // Reconnect with same ID
    const res2 = await fetch(`${BASE_URL}/api/room/${roomName}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AnyName', playerId: originalId })
    });
    const data2 = await res2.json();
    
    expect(data2.reconnected).toBe(true);
    expect(data2.playerId).toBe(originalId);
  });
});