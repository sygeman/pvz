import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { cors } from '@elysiajs/cors';
import { createRoom, spawnBaby, broadcast, BABY_TYPES } from './game';
import type { Room, Player, JoinRequest, ClickRequest, ServerEvent } from './types';

// Game state
const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId)!;
}

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({
    assets: './client/dist',
    prefix: '/'
  }))
  
  // Health check
  .get('/api/health', () => ({ ok: true }))
  
  // SSE endpoint
  .get('/api/room/:roomId/events', ({ params: { roomId }, set }) => {
    const room = getOrCreateRoom(roomId);
    
    // Spawn baby if none exists
    if (!room.baby) {
      room.baby = spawnBaby();
      room.babySpawnTime = Date.now();
    }
    
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';
    
    const { readable, writable } = new TransformStream<string>();
    const writer = writable.getWriter();
    
    room.clients.push(writer);
    
    // Send initial state
    const initEvent: ServerEvent = {
      type: 'init',
      baby: room.baby,
      players: Array.from(room.players.values())
    };
    writer.write(`data: ${JSON.stringify(initEvent)}\n\n`);
    
    return readable;
  })
  
  // Join room
  .post('/api/room/:roomId/join', ({ params: { roomId }, body }) => {
    const { name, playerId: existingId } = body as JoinRequest;
    const room = getOrCreateRoom(roomId);
    
    // Spawn baby if none exists
    if (!room.baby) {
      room.baby = spawnBaby();
      room.babySpawnTime = Date.now();
    }
    
    // Try reconnect if playerId provided
    if (existingId && room.players.has(existingId)) {
      const player = room.players.get(existingId)!;
      return { 
        playerId: existingId, 
        player, 
        baby: room.baby, 
        reconnected: true 
      };
    }
    
    const playerId = crypto.randomUUID();
    const player: Player = {
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
    
    return { playerId, player, baby: room.baby };
  })
  
  // Click baby
  .post('/api/room/:roomId/click', ({ params: { roomId }, body }) => {
    const { playerId, damage = 1 } = body as ClickRequest;
    const room = getOrCreateRoom(roomId);
    
    const player = room.players.get(playerId);
    if (!player || !room.baby) {
      return { error: 'Invalid' };
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
      
      return { 
        killed: true, 
        reward: killedBaby.reward, 
        player,
        baby: room.baby 
      };
    }
    
    broadcast(room, {
      type: 'baby-damaged',
      baby: room.baby,
      attacker: player
    });
    
    return { killed: false, baby: room.baby, player };
  })
  
  // Leaderboard
  .get('/api/room/:roomId/leaderboard', ({ params: { roomId } }) => {
    const room = getOrCreateRoom(roomId);
    
    return Array.from(room.players.values())
      .sort((a, b) => b.money - a.money)
      .slice(0, 10);
  })
  
  .listen(process.env.PORT || 3000);

console.log(`🧟‍♀️ Бабы-Зомби сервер на порту ${app.server?.port}`);