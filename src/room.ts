import type { Room, Player, ServerEvent } from './types';
import { spawnBaby } from './game';

const ROOM_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export interface WSClient {
  id: string;
  ws: any;
  playerId?: string;
}

const rooms = new Map<string, Room>();
const wsClients = new Map<string, Map<string, WSClient>>();
const wsConnections = new Map<string, { ws: any; lastPong: number; roomId: string }>();

export function createRoom(roomId: string): Room {
  const now = Date.now();
  rooms.set(roomId, {
    id: roomId,
    players: new Map(),
    baby: null,
    babySpawnTime: 0,
    totalDamageDealt: 0,
    lastActivity: now
  });
  wsClients.set(roomId, new Map());
  return rooms.get(roomId)!;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    return createRoom(roomId);
  }
  return rooms.get(roomId)!;
}

export function ensureBaby(room: Room): void {
  if (!room.baby) {
    room.baby = spawnBaby();
    room.babySpawnTime = Date.now();
    room.totalDamageDealt = 0;
  }
}

export function updateRoomActivity(room: Room): void {
  room.lastActivity = Date.now();
}

export function addClient(roomId: string, ws: any): string {
  const clientId = crypto.randomUUID();
  const clients = wsClients.get(roomId);
  if (clients) {
    clients.set(clientId, { id: clientId, ws });
    wsConnections.set(clientId, { ws, lastPong: Date.now(), roomId });
  }
  return clientId;
}

export function removeClient(clientId: string): void {
  const conn = wsConnections.get(clientId);
  if (conn) {
    const clients = wsClients.get(conn.roomId);
    if (clients) clients.delete(clientId);
    wsConnections.delete(clientId);
  }
}

export async function broadcast(roomId: string, event: ServerEvent): Promise<void> {
  const clients = wsClients.get(roomId);
  if (!clients) return;

  const message = JSON.stringify(event);
  const deadClients: string[] = [];

  for (const [id, client] of clients) {
    try {
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      } else {
        deadClients.push(id);
      }
    } catch {
      deadClients.push(id);
    }
  }

  for (const id of deadClients) {
    removeClient(id);
  }

  const room = rooms.get(roomId);
  if (room) updateRoomActivity(room);
}

export function sendToClient(clientId: string, data: unknown): void {
  const conn = wsConnections.get(clientId);
  if (conn && conn.ws.readyState === 1) {
    conn.ws.send(JSON.stringify(data));
  }
}

export function getPlayersArray(room: Room): Player[] {
  return Array.from(room.players.values());
}

export function cleanupEmptyRooms(): void {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now - room.lastActivity > ROOM_TIMEOUT_MS) {
      const clients = wsClients.get(roomId);
      if (room.players.size === 0 && (!clients || clients.size === 0)) {
        rooms.delete(roomId);
        wsClients.delete(roomId);
        console.log(`Cleaned up empty room: ${roomId}`);
      }
    }
  }
}

export function startCleanup(): void {
  setInterval(cleanupEmptyRooms, 60 * 60 * 1000);
}

export function startPingPong(): void {
  setInterval(() => {
    const now = Date.now();
    const deadConnections: string[] = [];

    for (const [clientId, conn] of wsConnections) {
      if (now - conn.lastPong > 60000) {
        deadConnections.push(clientId);
        try {
          conn.ws.close();
        } catch {}
        continue;
      }

      try {
        if (conn.ws.readyState === 1) {
          conn.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
        }
      } catch {
        deadConnections.push(clientId);
      }
    }

    for (const clientId of deadConnections) {
      removeClient(clientId);
    }
  }, 20000);
}

export function getStats() {
  return {
    rooms: rooms.size,
    wsConnections: wsConnections.size
  };
}
