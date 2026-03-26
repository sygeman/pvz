import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import {
  createPlayer,
  applyDamage,
  processKill,
  spawnNewBaby,
  validateRoomId,
  ValidationError
} from './game';
import type { Player, Baby } from './types';
import {
  getOrCreateRoom,
  getRoom,
  ensureBaby,
  addClient,
  removeClient,
  broadcast,
  sendToClient,
  getPlayersArray,
  updateRoomActivity,
  startCleanup,
  startPingPong,
  getStats
} from './room';

const JoinMessage = t.Object({
  type: t.Literal('join'),
  name: t.String({ minLength: 1, maxLength: 20 }),
  playerId: t.Optional(t.String())
});

const ClickMessage = t.Object({
  type: t.Literal('click'),
  playerId: t.String()
});

const PongMessage = t.Object({
  type: t.Literal('pong'),
  timestamp: t.Number()
});

function handleBabyDeath(room: ReturnType<typeof getOrCreateRoom>, player: Player, killedBaby: Baby, clientId?: string, damage?: number, xpGained?: number, leveledUp?: boolean) {
  const { newBaby, bonusXp } = handleKillEvents(room, player, killedBaby);

  const result = {
    type: 'click-result' as const,
    killed: true,
    reward: killedBaby.reward,
    bonusXp,
    player,
    baby: newBaby,
    damage: damage ?? 0,
    xpGained: xpGained ?? 0,
    leveledUp: leveledUp ?? false
  };

  if (clientId) sendToClient(clientId, result);
}

function handleKillEvents(room: ReturnType<typeof getOrCreateRoom>, player: Player, killedBaby: Baby) {
  const { bonusXp } = processKill(player, killedBaby);
  const newBaby = spawnNewBaby(room);

  broadcast(room.id, { type: 'player-leveled-up', player, newLevel: player.level });
  broadcast(room.id, {
    type: 'baby-killed',
    killer: player,
    reward: killedBaby.reward,
    newBaby,
    players: getPlayersArray(room),
    bonusXp
  });

  return { newBaby, bonusXp };
}

startCleanup();
startPingPong();

const app = new Elysia()
  .use(cors())
  
  .onError(({ code, error, set }) => {
    if (error instanceof ValidationError) {
      set.status = 400;
      return { error: error.message };
    }
    console.error(`[${new Date().toISOString()}] Error ${code}:`, error);
    set.status = 500;
    return { error: 'Internal server error' };
  })
  
  .get('/api/health', () => ({
    ok: true,
    ...getStats(),
    uptime: process.uptime()
  }))
  
  .ws('/ws/:roomId', {
    params: t.Object({ roomId: t.String() }),

    open(ws) {
      const roomId = validateRoomId(ws.data.params.roomId);
      const room = getOrCreateRoom(roomId);
      ensureBaby(room);
      
      const clientId = addClient(roomId, ws);
      (ws as any).clientId = clientId;
      (ws as any).roomId = roomId;

      sendToClient(clientId, { type: 'init', clientId, baby: room.baby, players: getPlayersArray(room) });
    },

    message(ws, message) {
      const clientId = (ws as any).clientId;
      const roomId = (ws as any).roomId;
      if (!clientId || !roomId) return;

      let data: any;
      try {
        data = typeof message === 'string' ? JSON.parse(message) : message;
      } catch {
        sendToClient(clientId, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        sendToClient(clientId, { type: 'error', message: 'Room not found' });
        return;
      }

      if (data.type === 'pong') return;

      if (data.type === 'join') {
        const existingId = data.playerId;
        if (existingId && typeof existingId === 'string') {
          const existing = room.players.get(existingId);
          if (existing) {
            updateRoomActivity(room);
            sendToClient(clientId, { type: 'joined', playerId: existingId, player: existing, baby: room.baby, reconnected: true });
            return;
          }
        }

        const player = createPlayer(data.name);
        room.players.set(player.id, player);
        updateRoomActivity(room);
        broadcast(roomId, { type: 'player-joined', player, players: getPlayersArray(room) });
        sendToClient(clientId, { type: 'joined', playerId: player.id, player, baby: room.baby });
        return;
      }

      const playerId = data.playerId;
      if (typeof playerId !== 'string') {
        sendToClient(clientId, { type: 'error', message: 'Invalid player ID' });
        return;
      }

      const player = room.players.get(playerId);
      if (!player || !room.baby) {
        sendToClient(clientId, { type: 'error', message: 'Invalid player or no baby' });
        return;
      }

      const baby = room.baby;
      if (baby.currentHp <= 0) {
        sendToClient(clientId, { type: 'error', message: 'Baby already dead', baby });
        return;
      }

      const { damage, xpGained, leveledUp } = applyDamage(player, baby);
      room.totalDamageDealt += damage;

      if (leveledUp) {
        broadcast(roomId, { type: 'player-leveled-up', player, newLevel: player.level });
      }

      if (baby.currentHp <= 0) {
        handleBabyDeath(room, player, baby, clientId, damage, xpGained, leveledUp);
        return;
      }

      broadcast(roomId, { type: 'baby-damaged', baby: room.baby, attacker: player, damage, xpGained });
      sendToClient(clientId, { type: 'click-result', killed: false, baby: room.baby, player, damage, xpGained, leveledUp });
    },

    close(ws) {
      const clientId = (ws as any).clientId;
      if (clientId) removeClient(clientId);
    }
  })
  
  .post('/api/:roomId/join', async ({ params: { roomId }, body }) => {
    const validRoomId = validateRoomId(roomId);
    const room = getOrCreateRoom(validRoomId);
    ensureBaby(room);
    
    if (body.playerId) {
      const existing = room.players.get(body.playerId);
      if (existing) {
        updateRoomActivity(room);
        return { playerId: body.playerId, player: existing, baby: room.baby, reconnected: true };
      }
    }
    
    const player = createPlayer(body.name);
    room.players.set(player.id, player);
    updateRoomActivity(room);
    await broadcast(validRoomId, { type: 'player-joined', player, players: getPlayersArray(room) });
    
    return { playerId: player.id, player, baby: room.baby };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 20 }),
      playerId: t.Optional(t.Union([t.String(), t.Null()]))
    })
  })
  
  .post('/api/:roomId/click', async ({ params: { roomId }, body }) => {
    const room = getRoom(validateRoomId(roomId));
    if (!room) return { error: 'Room not found' };
    
    const player = room.players.get(body.playerId);
    if (!player || !room.baby) return { error: 'Invalid player or no baby' };
    
    const baby = room.baby;
    if (baby.currentHp <= 0) return { error: 'Baby already dead', baby };
    
    const { damage, xpGained, leveledUp } = applyDamage(player, baby);
    room.totalDamageDealt += damage;
    
    if (leveledUp) {
      await broadcast(room.id, { type: 'player-leveled-up', player, newLevel: player.level });
    }
    
    if (baby.currentHp <= 0) {
      const { newBaby, bonusXp } = handleKillEvents(room, player, baby);
      return { killed: true, reward: baby.reward, bonusXp, player, baby: newBaby, damage, xpGained, leveledUp };
    }
    
    updateRoomActivity(room);
    return { killed: false, baby: room.baby, player, damage, xpGained, leveledUp };
  }, {
    body: t.Object({ playerId: t.String() })
  })
  
  .get('/api/:roomId/leaderboard', ({ params: { roomId } }) => {
    const room = getRoom(validateRoomId(roomId));
    if (!room) return [];
    return getPlayersArray(room)
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .slice(0, 10);
  })
  
  .use(staticPlugin({ assets: './client/dist', prefix: '/' }))
  
  .listen(process.env.PORT || 3000);

console.log(`🧟‍♀️ Бабы-Зомби на порту ${app.server?.port}`);
