import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { 
  createRoom, 
  spawnBaby, 
  broadcast, 
  validatePlayerName, 
  validateRoomId,
  updateRoomActivity,
  cleanupEmptyRooms
} from './game';
import type { Room, ClientConnection } from './types';

// Game state
const rooms = new Map<string, Room>();
let clientIdCounter = 0;

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId)!;
}

// Cleanup empty rooms every hour
setInterval(() => cleanupEmptyRooms(rooms), 60 * 60 * 1000);

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({
    assets: './client/dist',
    prefix: '/'
  }))
  
  // Error handler
  .onError(({ code, error }) => {
    console.error(`Error ${code}:`, error);
    if (code === 'VALIDATION') {
      return { error: 'Invalid input', details: error.message };
    }
    return { error: 'Internal server error' };
  })
  
  // Health check
  .get('/api/health', () => ({ 
    ok: true, 
    rooms: rooms.size,
    uptime: process.uptime()
  }))
  
  // SSE endpoint
  .get('/api/room/:roomId/events', ({ params: { roomId }, set, request }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = getOrCreateRoom(validRoomId);
      
      // Spawn baby if none exists
      if (!room.baby) {
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
      }
      
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';
      
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const clientId = ++clientIdCounter;
      
      const client: ClientConnection = { id: clientId, writer, encoder };
      room.clients.push(client);
      
      // Send initial state
      const initEvent = {
        type: 'init' as const,
        baby: room.baby,
        players: Array.from(room.players.values())
      };
      writer.write(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`));
      
      // Handle client disconnect
      const cleanup = () => {
        const index = room.clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
          room.clients.splice(index, 1);
        }
        try {
          writer.close();
        } catch {}
      };
      
      request.signal.addEventListener('abort', cleanup);
      
      // Also cleanup on write errors
      writer.closed.catch(() => cleanup());
      
      return readable;
    } catch (error) {
      console.error('SSE error:', error);
      set.status = 400;
      return { error: error instanceof Error ? error.message : 'Invalid request' };
    }
  })
  
  // Join room
  .post('/api/room/:roomId/join', ({ params: { roomId }, body }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = getOrCreateRoom(validRoomId);
      const name = validatePlayerName(body.name);
      const existingId = body.playerId;
      
      // Spawn baby if none exists
      if (!room.baby) {
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
      }
      
      // Try reconnect if playerId provided and player exists
      if (existingId && typeof existingId === 'string') {
        const existingPlayer = room.players.get(existingId);
        if (existingPlayer) {
          updateRoomActivity(room);
          return { 
            playerId: existingId, 
            player: existingPlayer, 
            baby: room.baby, 
            reconnected: true 
          };
        }
      }
      
      // Create new player
      const playerId = crypto.randomUUID();
      const player = {
        id: playerId,
        name,
        clicks: 0,
        money: 0,
        kills: 0,
        joinedAt: Date.now()
      };
      
      room.players.set(playerId, player);
      updateRoomActivity(room);
      
      broadcast(room, {
        type: 'player-joined',
        player,
        players: Array.from(room.players.values())
      });
      
      return { playerId, player, baby: room.baby };
    } catch (error) {
      console.error('Join error:', error);
      return { error: error instanceof Error ? error.message : 'Failed to join' };
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 20 }),
      playerId: t.Optional(t.String())
    })
  })
  
  // Click baby with atomic operation
  .post('/api/room/:roomId/click', ({ params: { roomId }, body }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) {
        return { error: 'Room not found' };
      }
      
      const { playerId, damage = 1 } = body;
      
      if (typeof playerId !== 'string') {
        return { error: 'Invalid player ID' };
      }
      
      const player = room.players.get(playerId);
      if (!player || !room.baby) {
        return { error: 'Invalid player or no baby' };
      }
      
      if (room.baby.currentHp <= 0) {
        return { error: 'Baby already dead', baby: room.baby };
      }
      
      // Apply damage atomically
      const actualDamage = Math.min(damage, room.baby.currentHp);
      player.clicks++;
      room.baby.currentHp -= actualDamage;
      
      // Baby killed
      if (room.baby.currentHp <= 0) {
        player.money += room.baby.reward;
        player.kills++;
        
        const killedBaby = room.baby;
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
        
        updateRoomActivity(room);
        
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
      
      // Baby damaged but alive
      updateRoomActivity(room);
      
      broadcast(room, {
        type: 'baby-damaged',
        baby: room.baby,
        attacker: player
      });
      
      return { killed: false, baby: room.baby, player };
    } catch (error) {
      console.error('Click error:', error);
      return { error: error instanceof Error ? error.message : 'Click failed' };
    }
  }, {
    body: t.Object({
      playerId: t.String(),
      damage: t.Optional(t.Number({ minimum: 1, maximum: 100 }))
    })
  })
  
  // Leaderboard
  .get('/api/room/:roomId/leaderboard', ({ params: { roomId } }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) {
        return [];
      }
      
      updateRoomActivity(room);
      
      return Array.from(room.players.values())
        .sort((a, b) => b.money - a.money)
        .slice(0, 10);
    } catch (error) {
      console.error('Leaderboard error:', error);
      return [];
    }
  })
  
  .listen(process.env.PORT || 3000);

console.log(`🧟‍♀️ Бабы-Зомби сервер на порту ${app.server?.port}`);