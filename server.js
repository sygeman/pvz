import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';

const app = new Hono();

// Game state
const rooms = new Map();
const BABY_TYPES = [
  { id: 'galya', name: 'Тётя Галя', hp: 10, reward: 100, emoji: '👵', desc: '50 заказов, 1 чехол' },
  { id: 'babushka', name: 'Бабушка', hp: 15, reward: 150, emoji: '👵', desc: '30 пар тапочек' },
  { id: 'mamochka', name: 'Мамочка', hp: 20, reward: 200, emoji: '👩‍🍼', desc: '25 позиций, ничего не взяла' },
  { id: 'shopogolik', name: 'Шопоголик', hp: 25, reward: 300, emoji: '💅', desc: '40 позиций по акциям' },
  { id: 'mega', name: 'МЕГА-БАБА', hp: 100, reward: 1000, emoji: '🧟‍♀️', desc: 'BOSS: 100 заказов!' }
];

function createRoom(roomId) {
  return {
    id: roomId,
    players: new Map(),
    baby: null,
    babySpawnTime: 0,
    clients: []
  };
}

function spawnBaby() {
  const type = BABY_TYPES[Math.floor(Math.random() * BABY_TYPES.length)];
  return {
    ...type,
    currentHp: type.hp,
    maxHp: type.hp,
    id: Date.now()
  };
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId);
}

function broadcast(room, data) {
  const dead = [];
  room.clients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      dead.push(client);
    }
  });
  room.clients = room.clients.filter(c => !dead.includes(c));
}

// Static files
app.use('/*', serveStatic({ root: './client/dist' }));

// SSE endpoint
app.get('/api/room/:roomId/events', (c) => {
  const roomId = c.req.param('roomId');
  const room = getOrCreateRoom(roomId);
  
  // Spawn baby if none exists
  if (!room.baby) {
    room.baby = spawnBaby();
    room.babySpawnTime = Date.now();
  }
  
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  room.clients.push(writer);
  
  // Send initial state
  writer.write(`data: ${JSON.stringify({
    type: 'init',
    baby: room.baby,
    players: Array.from(room.players.values())
  })}\n\n`);
  
  c.req.raw.signal.addEventListener('abort', () => {
    room.clients = room.clients.filter(c => c !== writer);
    writer.close();
  });
  
  return c.body(readable);
});

// Join room
app.post('/api/room/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const { name } = await c.req.json();
  const room = getOrCreateRoom(roomId);
  
  const playerId = crypto.randomUUID();
  const player = {
    id: playerId,
    name: name || 'Игрок',
    clicks: 0,
    money: 0,
    kills: 0,
    joinedAt: Date.now()
  };
  
  room.players.set(playerId, player);
  
  broadcast(room, {
    type: 'player-joined',
    player,
    players: Array.from(room.players.values())
  });
  
  return c.json({ playerId, player, baby: room.baby });
});

// Click baby
app.post('/api/room/:roomId/click', async (c) => {
  const roomId = c.req.param('roomId');
  const { playerId, damage = 1 } = await c.req.json();
  const room = getOrCreateRoom(roomId);
  
  const player = room.players.get(playerId);
  if (!player || !room.baby) {
    return c.json({ error: 'Invalid' }, 400);
  }
  
  player.clicks++;
  room.baby.currentHp -= damage;
  
  // Baby killed
  if (room.baby.currentHp <= 0) {
    player.money += room.baby.reward;
    player.kills++;
    
    const killedBaby = room.baby;
    room.baby = spawnBaby();
    room.babySpawnTime = Date.now();
    
    broadcast(room, {
      type: 'baby-killed',
      killer: player,
      reward: killedBaby.reward,
      newBaby: room.baby,
      players: Array.from(room.players.values())
    });
    
    return c.json({ 
      killed: true, 
      reward: killedBaby.reward, 
      player,
      baby: room.baby 
    });
  }
  
  broadcast(room, {
    type: 'baby-damaged',
    baby: room.baby,
    attacker: player
  });
  
  return c.json({ killed: false, baby: room.baby, player });
});

// Leaderboard
app.get('/api/room/:roomId/leaderboard', (c) => {
  const roomId = c.req.param('roomId');
  const room = getOrCreateRoom(roomId);
  
  const sorted = Array.from(room.players.values())
    .sort((a, b) => b.money - a.money)
    .slice(0, 10);
  
  return c.json(sorted);
});

// Health check
app.get('/api/health', (c) => c.json({ ok: true }));

const port = process.env.PORT || 3000;
console.log(`Clicker server on port ${port}`);
serve({ fetch: app.fetch, port });
