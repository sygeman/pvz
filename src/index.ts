import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { 
  createRoom, 
  spawnBaby, 
  broadcast, 
  createPlayer,
  validatePlayerName, 
  validateRoomId,
  updateRoomActivity,
  cleanupEmptyRooms,
  calculateXpToNextLevel,
  calculateDamage,
  calculateLevelUp
} from './game';
import type { Room } from './types';

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
  
  // Error handler
  .onError(({ code, error, set }) => {
    console.error(`Error ${code}:`, error);
    if (code === 'VALIDATION') {
      set.status = 400;
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
  
  // SSE endpoint - MUST be before static plugin
  .get('/api/room/:roomId/events', ({ params: { roomId }, set, request }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = getOrCreateRoom(validRoomId);
      
      // Spawn baby if none exists
      if (!room.baby) {
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
        room.totalDamageDealt = 0;
      }
      
      set.headers['content-type'] = 'text/event-stream';
      set.headers['cache-control'] = 'no-cache';
      set.headers['connection'] = 'keep-alive';
      set.headers['x-accel-buffering'] = 'no'; // Disable nginx buffering if behind proxy
      
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const clientId = ++clientIdCounter;
      
      room.clients.push({ id: clientId, writer, encoder });
      
      // Send initial state
      const initEvent = {
        type: 'init' as const,
        baby: room.baby,
        players: Array.from(room.players.values())
      };
      writer.write(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`)).catch(() => {});
      
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
      writer.closed.catch(() => cleanup());
      
      return readable;
    } catch (error) {
      console.error('SSE error:', error);
      set.status = 400;
      return { error: error instanceof Error ? error.message : 'Invalid request' };
    }
  })
  
  // Join room
  .post('/api/room/:roomId/join', async ({ params: { roomId }, body }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = getOrCreateRoom(validRoomId);
      const name = validatePlayerName(body.name);
      const existingId = body.playerId;
      
      // Spawn baby if none exists
      if (!room.baby) {
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
        room.totalDamageDealt = 0;
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
      const player = createPlayer(name);
      room.players.set(player.id, player);
      
      updateRoomActivity(room);
      
      await broadcast(room, {
        type: 'player-joined',
        player,
        players: Array.from(room.players.values())
      });
      
      return { playerId: player.id, player, baby: room.baby };
    } catch (error) {
      console.error('Join error:', error);
      return { error: error instanceof Error ? error.message : 'Failed to join' };
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 20 }),
      playerId: t.Optional(t.Union([t.String(), t.Null()]))
    })
  })
  
  // Click baby with PvE progression mechanics
  .post('/api/room/:roomId/click', async ({ params: { roomId }, body }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) {
        return { error: 'Room not found' };
      }
      
      const { playerId } = body;
      
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
      
      // Calculate damage based on player level
      const damage = player.damage;
      
      // Apply damage
      const actualDamage = Math.min(damage, room.baby.currentHp);
      player.clicks++;
      player.totalDamage += actualDamage;
      room.baby.currentHp -= actualDamage;
      room.totalDamageDealt += actualDamage;
      
      // Calculate XP gained
      const xpGained = actualDamage * 5;
      player.xp += xpGained;
      
      // Check for level up
      const levelUpResult = calculateLevelUp(player.level, player.xp, player.xpToNextLevel);
      
      let leveledUp = false;
      if (levelUpResult.levelsGained > 0) {
        player.level = levelUpResult.newLevel;
        player.xp = levelUpResult.newXp;
        player.xpToNextLevel = levelUpResult.newXpToNext;
        player.damage = calculateDamage(player.level);
        leveledUp = true;
        
        // Notify about level up
        await broadcast(room, {
          type: 'player-leveled-up',
          player,
          newLevel: player.level
        });
      }
      
      // Baby killed
      if (room.baby.currentHp <= 0) {
        player.kills++;
        
        // Bonus XP for kill based on baby max HP
        const bonusXp = Math.floor(room.baby.maxHp * 0.1);
        player.xp += bonusXp;
        
        // Check for level up from bonus XP
        const killLevelUpResult = calculateLevelUp(player.level, player.xp, player.xpToNextLevel);
        if (killLevelUpResult.levelsGained > 0) {
          player.level = killLevelUpResult.newLevel;
          player.xp = killLevelUpResult.newXp;
          player.xpToNextLevel = killLevelUpResult.newXpToNext;
          player.damage = calculateDamage(player.level);
          
          await broadcast(room, {
            type: 'player-leveled-up',
            player,
            newLevel: player.level
          });
        }
        
        const killedBaby = room.baby;
        room.baby = spawnBaby();
        room.babySpawnTime = Date.now();
        room.totalDamageDealt = 0;
        
        updateRoomActivity(room);
        
        await broadcast(room, {
          type: 'baby-killed',
          killer: player,
          reward: killedBaby.reward,
          newBaby: room.baby,
          players: Array.from(room.players.values()),
          bonusXp
        });
        
        return { 
          killed: true, 
          reward: killedBaby.reward,
          bonusXp,
          player,
          baby: room.baby,
          damage: actualDamage,
          xpGained,
          leveledUp
        };
      }
      
      // Baby damaged but alive
      updateRoomActivity(room);
      
      await broadcast(room, {
        type: 'baby-damaged',
        baby: room.baby,
        attacker: player,
        damage: actualDamage,
        xpGained
      });
      
      return { 
        killed: false, 
        baby: room.baby, 
        player,
        damage: actualDamage,
        xpGained,
        leveledUp
      };
    } catch (error) {
      console.error('Click error:', error);
      return { error: error instanceof Error ? error.message : 'Click failed' };
    }
  }, {
    body: t.Object({
      playerId: t.String()
    })
  })
  
  // Leaderboard (by total damage dealt)
  .get('/api/room/:roomId/leaderboard', ({ params: { roomId } }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) {
        return [];
      }
      
      updateRoomActivity(room);
      
      return Array.from(room.players.values())
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 10);
    } catch (error) {
      console.error('Leaderboard error:', error);
      return [];
    }
  })
  
  // Get room stats
  .get('/api/room/:roomId/stats', ({ params: { roomId } }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) {
        return { error: 'Room not found' };
      }
      
      return {
        totalDamageDealt: room.totalDamageDealt,
        playerCount: room.players.size,
        baby: room.baby
      };
    } catch (error) {
      console.error('Stats error:', error);
      return { error: 'Failed to get stats' };
    }
  })
  
  // Static files - MUST be after API routes
  .use(staticPlugin({
    assets: './client/dist',
    prefix: '/'
  }))
  
  .listen(process.env.PORT || 3000);

console.log(`🧟‍♀️ Бабы-Зомби PvE сервер на порту ${app.server?.port}`);