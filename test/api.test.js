import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('Бабы-Зомби API', () => {
  let playerId = null;
  let roomId = 'TEST' + Math.floor(Math.random() * 1000);

  describe('Health Check', () => {
    it('должен вернуть ok', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Join Room', () => {
    it('должен создать нового игрока', async () => {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Тестер' })
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.playerId).toBeDefined();
      expect(data.player.name).toBe('Тестер');
      expect(data.player.money).toBe(0);
      expect(data.player.kills).toBe(0);
      expect(data.baby).toBeDefined();
      expect(data.baby.hp).toBeDefined();
      
      playerId = data.playerId;
    });

    it('должен переподключить существующего игрока', async () => {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Тестер', playerId })
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.reconnected).toBe(true);
      expect(data.playerId).toBe(playerId);
    });
  });

  describe('Click Baby', () => {
    it('должен нанести урон бабе', async () => {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, damage: 1 })
      });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.killed).toBe(false);
      expect(data.baby.currentHp).toBeDefined();
    });

    it('должен отклонить невалидный playerId', async () => {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'invalid', damage: 1 })
      });
      
      expect(res.status).toBe(400);
    });
  });

  describe('Leaderboard', () => {
    it('должен вернуть топ игроков', async () => {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/leaderboard`);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBeDefined();
      expect(data[0].money).toBeDefined();
    });
  });

  describe('SSE Events', () => {
    it('должен подключиться к SSE', async () => {
      const eventSource = new EventSource(`${BASE_URL}/api/room/${roomId}/events`);
      
      const message = await new Promise((resolve, reject) => {
        eventSource.onmessage = (e) => resolve(JSON.parse(e.data));
        eventSource.onerror = () => reject(new Error('SSE error'));
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });
      
      expect(message.type).toBe('init');
      expect(message.baby).toBeDefined();
      
      eventSource.close();
    });
  });
});

describe('Игровая механика', () => {
  it('должен убить бабу после достаточного количества кликов', async () => {
    const roomId = 'KILLTEST' + Date.now();
    
    // Создаём игрока
    const joinRes = await fetch(`${BASE_URL}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Убийца' })
    });
    const { playerId, baby } = await joinRes.json();
    
    // Кликаем пока не убьём
    let killed = false;
    let attempts = 0;
    
    while (!killed && attempts < baby.maxHp + 10) {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, damage: 1 })
      });
      const data = await res.json();
      
      if (data.killed) {
        killed = true;
        expect(data.reward).toBeGreaterThan(0);
        expect(data.player.money).toBeGreaterThan(0);
        expect(data.player.kills).toBe(1);
      }
      
      attempts++;
    }
    
    expect(killed).toBe(true);
  });

  it('должен спавнить новую бабу после убийства', async () => {
    const roomId = 'SPAWNTEST' + Date.now();
    
    const joinRes = await fetch(`${BASE_URL}/api/room/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Тест' })
    });
    const { playerId, baby: firstBaby } = await joinRes.json();
    
    // Убиваем бабу
    let killed = false;
    while (!killed) {
      const res = await fetch(`${BASE_URL}/api/room/${roomId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, damage: 10 })
      });
      const data = await res.json();
      killed = data.killed;
      if (killed) {
        expect(data.baby.id).not.toBe(firstBaby.id);
        expect(data.baby.currentHp).toBe(data.baby.maxHp);
      }
    }
  });
});
