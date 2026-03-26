import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { 
  createRoom, 
  spawnBaby, 
  createPlayer,
  validatePlayerName, 
  validateRoomId,
  updateRoomActivity,
  cleanupEmptyRooms,
  calculateXpToNextLevel,
  calculateDamage,
  calculateLevelUp,
  ValidationError
} from './game';
import type { Room, Player } from './types';

// Game state
const rooms = new Map<string, Room>();

// WebSocket clients by room
interface WSClient {
  id: string;
  ws: any;
  playerId?: string;
}
const wsClients = new Map<string, Map<string, WSClient>>(); // roomId -> Map<clientId, client>

// Keep track of all WebSocket connections for ping/pong
const wsConnections = new Map<string, { ws: any; lastPong: number; roomId: string }>();

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
    wsClients.set(roomId, new Map());
  }
  return rooms.get(roomId)!;
}

// Broadcast to all WebSocket clients in a room
async function broadcastToRoom(roomId: string, data: unknown): Promise<void> {
  const clients = wsClients.get(roomId);
  if (!clients) return;

  const message = JSON.stringify(data);
  const deadClients: string[] = [];

  for (const [clientId, client] of clients) {
    try {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(message);
      } else {
        deadClients.push(clientId);
      }
    } catch {
      deadClients.push(clientId);
    }
  }

  // Remove dead clients
  for (const clientId of deadClients) {
    clients.delete(clientId);
    wsConnections.delete(clientId);
  }

  const room = rooms.get(roomId);
  if (room) updateRoomActivity(room);
}

// Cleanup empty rooms every hour
setInterval(() => cleanupEmptyRooms(rooms), 60 * 60 * 1000);

// Ping/pong keepalive for Railway (every 20 seconds)
setInterval(() => {
  const now = Date.now();
  const deadConnections: string[] = [];

  for (const [clientId, conn] of wsConnections) {
    // Check if connection is stale (no pong for 60 seconds)
    if (now - conn.lastPong > 60000) {
      deadConnections.push(clientId);
      try {
        conn.ws.close();
      } catch {}
      continue;
    }

    // Send ping
    try {
      if (conn.ws.readyState === 1) {
        conn.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
      }
    } catch {
      deadConnections.push(clientId);
    }
  }

  // Clean up dead connections
  for (const clientId of deadConnections) {
    const conn = wsConnections.get(clientId);
    if (conn) {
      const clients = wsClients.get(conn.roomId);
      if (clients) clients.delete(clientId);
      wsConnections.delete(clientId);
    }
  }
}, 20000);

const app = new Elysia()
  .use(cors())
  
  // Error handler
  .onError(({ code, error, set, request }) => {
    console.error(`[${new Date().toISOString()}] Error ${code}:`, error);
    console.error(`  Path: ${request.method} ${request.url}`);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (code === 'VALIDATION' || error instanceof ValidationError) {
      set.status = 400;
      return { error: 'Invalid input', details: errorMessage, code: 'VALIDATION_ERROR' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found' };
    }
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  
  // Health check
  .get('/api/health', () => ({ 
    ok: true, 
    rooms: rooms.size,
    wsConnections: wsConnections.size,
    uptime: process.uptime()
  }))
  
  // WebSocket endpoint
  .ws('/ws/room/:roomId', {
    // Validate room ID from params
    params: t.Object({
      roomId: t.String()
    }),

    open(ws) {
      try {
        const roomId = validateRoomId(ws.data.params.roomId);
        const room = getOrCreateRoom(roomId);
        const clientId = crypto.randomUUID();

        // Spawn baby if none exists
        if (!room.baby) {
          room.baby = spawnBaby();
          room.babySpawnTime = Date.now();
          room.totalDamageDealt = 0;
        }

        // Store client
        const clients = wsClients.get(roomId)!;
        clients.set(clientId, { id: clientId, ws });
        wsConnections.set(clientId, { ws, lastPong: Date.now(), roomId });

        // Store clientId on ws for cleanup
        (ws as any).clientId = clientId;
        (ws as any).roomId = roomId;

        // Send initial state
        ws.send(JSON.stringify({
          type: 'init',
          clientId,
          baby: room.baby,
          players: Array.from(room.players.values())
        }));

        console.log(`[WS] Client ${clientId} joined room ${roomId}`);
      } catch (error) {
        console.error('[WS] Open error:', error);
        ws.close();
      }
    },

    message(ws, message) {
      try {
        const clientId = (ws as any).clientId;
        const roomId = (ws as any).roomId;
        if (!clientId || !roomId) return;

        const room = rooms.get(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }

        // Parse message
        let data: any;
        try {
          data = typeof message === 'string' ? JSON.parse(message) : message;
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
          return;
        }

        // Handle pong
        if (data.type === 'pong') {
          const conn = wsConnections.get(clientId);
          if (conn) conn.lastPong = Date.now();
          return;
        }

        // Handle join (associate player with this connection)
        if (data.type === 'join') {
          const name = validatePlayerName(data.name);
          const existingId = data.playerId;

          // Try reconnect if playerId provided and player exists
          if (existingId && typeof existingId === 'string') {
            const existingPlayer = room.players.get(existingId);
            if (existingPlayer) {
              const clients = wsClients.get(roomId)!;
              const client = clients.get(clientId);
              if (client) client.playerId = existingId;

              ws.send(JSON.stringify({
                type: 'joined',
                playerId: existingId,
                player: existingPlayer,
                baby: room.baby,
                reconnected: true
              }));

              updateRoomActivity(room);
              return;
            }
          }

          // Create new player
          const player = createPlayer(name);
          room.players.set(player.id, player);

          const clients = wsClients.get(roomId)!;
          const client = clients.get(clientId);
          if (client) client.playerId = player.id;

          updateRoomActivity(room);

          // Broadcast to all clients
          broadcastToRoom(roomId, {
            type: 'player-joined',
            player,
            players: Array.from(room.players.values())
          });

          ws.send(JSON.stringify({
            type: 'joined',
            playerId: player.id,
            player,
            baby: room.baby
          }));

          return;
        }

        // Handle click
        if (data.type === 'click') {
          const playerId = data.playerId;
          if (typeof playerId !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid player ID' }));
            return;
          }

          const player = room.players.get(playerId);
          if (!player || !room.baby) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid player or no baby' }));
            return;
          }

          if (room.baby.currentHp <= 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'Baby already dead', baby: room.baby }));
            return;
          }

          // Calculate and apply damage
          const damage = player.damage;
          const actualDamage = Math.min(damage, room.baby.currentHp);
          player.clicks++;
          player.totalDamage += actualDamage;
          room.baby.currentHp -= actualDamage;
          room.totalDamageDealt += actualDamage;

          // Calculate XP
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

            broadcastToRoom(roomId, {
              type: 'player-leveled-up',
              player,
              newLevel: player.level
            });
          }

          // Baby killed
          if (room.baby.currentHp <= 0) {
            player.kills++;
            const bonusXp = Math.floor(room.baby.maxHp * 0.1);
            player.xp += bonusXp;

            // Check level up from bonus
            const killLevelUpResult = calculateLevelUp(player.level, player.xp, player.xpToNextLevel);
            if (killLevelUpResult.levelsGained > 0) {
              player.level = killLevelUpResult.newLevel;
              player.xp = killLevelUpResult.newXp;
              player.xpToNextLevel = killLevelUpResult.newXpToNext;
              player.damage = calculateDamage(player.level);

              broadcastToRoom(roomId, {
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

            broadcastToRoom(roomId, {
              type: 'baby-killed',
              killer: player,
              reward: killedBaby.reward,
              newBaby: room.baby,
              players: Array.from(room.players.values()),
              bonusXp
            });

            ws.send(JSON.stringify({
              type: 'click-result',
              killed: true,
              reward: killedBaby.reward,
              bonusXp,
              player,
              baby: room.baby,
              damage: actualDamage,
              xpGained,
              leveledUp
            }));
            return;
          }

          // Baby damaged but alive
          updateRoomActivity(room);

          broadcastToRoom(roomId, {
            type: 'baby-damaged',
            baby: room.baby,
            attacker: player,
            damage: actualDamage,
            xpGained
          });

          ws.send(JSON.stringify({
            type: 'click-result',
            killed: false,
            baby: room.baby,
            player,
            damage: actualDamage,
            xpGained,
            leveledUp
          }));
          return;
        }

        // Handle get-leaderboard
        if (data.type === 'get-leaderboard') {
          const leaderboard = Array.from(room.players.values())
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .slice(0, 10);

          ws.send(JSON.stringify({
            type: 'leaderboard',
            leaderboard
          }));
          return;
        }

        // Handle get-stats
        if (data.type === 'get-stats') {
          ws.send(JSON.stringify({
            type: 'stats',
            totalDamageDealt: room.totalDamageDealt,
            playerCount: room.players.size,
            baby: room.baby
          }));
          return;
        }

      } catch (error) {
        console.error('[WS] Message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }));
      }
    },

    close(ws) {
      const clientId = (ws as any).clientId;
      const roomId = (ws as any).roomId;
      
      if (clientId && roomId) {
        const clients = wsClients.get(roomId);
        if (clients) clients.delete(clientId);
        wsConnections.delete(clientId);
        console.log(`[WS] Client ${clientId} left room ${roomId}`);
      }
    }
  })
  
  // Legacy HTTP endpoints (for backward compatibility)
  // Join room via HTTP
  .post('/api/room/:roomId/join', async ({ params: { roomId }, body, set }) => {
    const validRoomId = validateRoomId(roomId);
    const room = getOrCreateRoom(validRoomId);
    const name = validatePlayerName(body.name);
    const existingId = body.playerId;
    
    if (!room.baby) {
      room.baby = spawnBaby();
      room.babySpawnTime = Date.now();
      room.totalDamageDealt = 0;
    }
    
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
    
    const player = createPlayer(name);
    room.players.set(player.id, player);
    updateRoomActivity(room);
    
    await broadcastToRoom(validRoomId, {
      type: 'player-joined',
      player,
      players: Array.from(room.players.values())
    });
    
    return { playerId: player.id, player, baby: room.baby };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 20 }),
      playerId: t.Optional(t.Union([t.String(), t.Null()]))
    })
  })
  
  // Leaderboard via HTTP
  .get('/api/room/:roomId/leaderboard', ({ params: { roomId } }) => {
    try {
      const validRoomId = validateRoomId(roomId);
      const room = rooms.get(validRoomId);
      
      if (!room) return [];
      
      updateRoomActivity(room);
      
      return Array.from(room.players.values())
        .sort((a, b) => b.totalDamage - a.totalDamage)
        .slice(0, 10);
    } catch {
      return [];
    }
  })
  
  // Static files
  .use(staticPlugin({
    assets: './client/dist',
    prefix: '/'
  }))
  
  .listen(process.env.PORT || 3000);

console.log(`🧟‍♀️ Бабы-Зомби PvE сервер на порту ${app.server?.port}`);
console.log(`📡 WebSocket endpoint: ws://localhost:${app.server?.port}/ws/room/{roomId}`);