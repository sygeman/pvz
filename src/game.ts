import type { Baby, BabyType, Player, Room } from './types';

export const BABY_TYPES: BabyType[] = [
  { id: 'galya', name: 'Тётя Галя', hp: 10, reward: 100, emoji: '👵', desc: '50 заказов, 1 чехол' },
  { id: 'babushka', name: 'Бабушка', hp: 15, reward: 150, emoji: '👵', desc: '30 пар тапочек' },
  { id: 'mamochka', name: 'Мамочка', hp: 20, reward: 200, emoji: '👩‍🍼', desc: '25 позиций, ничего не взяла' },
  { id: 'shopogolik', name: 'Шопоголик', hp: 25, reward: 300, emoji: '💅', desc: '40 позиций по акциям' },
  { id: 'mega', name: 'МЕГА-БАБА', hp: 100, reward: 1000, emoji: '🧟‍♀️', desc: 'BOSS: 100 заказов!' }
];

// Track last activity for room cleanup
const roomLastActivity = new Map<string, number>();
const ROOM_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export function spawnBaby(): Baby {
  const type = BABY_TYPES[Math.floor(Math.random() * BABY_TYPES.length)];
  return {
    ...type,
    currentHp: type.hp,
    maxHp: type.hp,
    instanceId: Date.now()
  };
}

export function createRoom(roomId: string): Room {
  roomLastActivity.set(roomId, Date.now());
  return {
    id: roomId,
    players: new Map(),
    baby: null,
    babySpawnTime: 0,
    clients: [],
    lastActivity: Date.now()
  };
}

export function updateRoomActivity(room: Room): void {
  room.lastActivity = Date.now();
  roomLastActivity.set(room.id, Date.now());
}

export function broadcast(room: Room, data: unknown): void {
  const dead: number[] = [];
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  room.clients.forEach((client, index) => {
    try {
      const encoded = client.encoder.encode(message);
      client.writer.write(encoded);
    } catch {
      dead.push(index);
    }
  });
  
  // Remove dead clients (in reverse order to preserve indices)
  dead.reverse().forEach(index => {
    const client = room.clients[index];
    try {
      client.writer.close();
    } catch {}
    room.clients.splice(index, 1);
  });
  
  updateRoomActivity(room);
}

export function removeClient(room: Room, clientId: number): void {
  const index = room.clients.findIndex(c => c.id === clientId);
  if (index !== -1) {
    const client = room.clients[index];
    try {
      client.writer.close();
    } catch {}
    room.clients.splice(index, 1);
  }
}

// Cleanup empty rooms periodically
export function cleanupEmptyRooms(rooms: Map<string, Room>): void {
  const now = Date.now();
  for (const [roomId, lastActivity] of roomLastActivity.entries()) {
    if (now - lastActivity > ROOM_TIMEOUT_MS) {
      const room = rooms.get(roomId);
      if (room && room.players.size === 0 && room.clients.length === 0) {
        rooms.delete(roomId);
        roomLastActivity.delete(roomId);
        console.log(`Cleaned up empty room: ${roomId}`);
      }
    }
  }
}

// Validate player name
export function validatePlayerName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new Error('Name must be a string');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Name cannot be empty');
  }
  if (trimmed.length > 20) {
    throw new Error('Name too long (max 20 characters)');
  }
  // Remove control characters and potential XSS
  const sanitized = trimmed.replace(/[<>\"']/g, '');
  return sanitized || 'Игрок';
}

// Validate room ID
export function validateRoomId(roomId: unknown): string {
  if (typeof roomId !== 'string') {
    throw new Error('Invalid room ID');
  }
  const sanitized = roomId.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  if (sanitized.length < 3 || sanitized.length > 20) {
    throw new Error('Invalid room ID length');
  }
  return sanitized;
}