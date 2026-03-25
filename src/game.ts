import type { Baby, BabyType, Player, Room } from './types';

export const BABY_TYPES: BabyType[] = [
  { id: 'galya', name: 'Тётя Галя', hp: 100, reward: 50, emoji: '👵', desc: 'Обычная баба' },
  { id: 'babushka', name: 'Бабушка', hp: 200, reward: 100, emoji: '👵', desc: 'Крепкая баба' },
  { id: 'mamochka', name: 'Мамочка', hp: 350, reward: 150, emoji: '👩‍🍼', desc: 'Злая мамочка' },
  { id: 'shopogolik', name: 'Шопоголик', hp: 500, reward: 250, emoji: '💅', desc: 'Баба со скидками' },
  { id: 'mega', name: 'МЕГА-БАБА', hp: 2000, reward: 1000, emoji: '🧟‍♀️', desc: 'BOSS: Рейдовая баба!' }
];

// Progression constants
const BASE_XP_TO_LEVEL = 100;
const XP_MULTIPLIER = 1.5;
const DAMAGE_PER_LEVEL_BASE = 1;
const DAMAGE_PER_LEVEL_MULTIPLIER = 0.5;
const XP_PER_DAMAGE = 5;
const KILL_BONUS_XP_MULTIPLIER = 0.1; // 10% of baby HP as bonus XP

// Track last activity for room cleanup
const roomLastActivity = new Map<string, number>();
const ROOM_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export function calculateXpToNextLevel(level: number): number {
  return Math.floor(BASE_XP_TO_LEVEL * Math.pow(XP_MULTIPLIER, level - 1));
}

export function calculateDamage(level: number): number {
  return Math.floor(DAMAGE_PER_LEVEL_BASE + (level - 1) * DAMAGE_PER_LEVEL_MULTIPLIER);
}

export function calculateLevelUp(currentLevel: number, currentXp: number, xpToNext: number): { 
  newLevel: number; 
  newXp: number; 
  newXpToNext: number;
  levelsGained: number;
} {
  let level = currentLevel;
  let xp = currentXp;
  let xpToNextLevel = xpToNext;
  let levelsGained = 0;
  
  while (xp >= xpToNextLevel) {
    xp -= xpToNextLevel;
    level++;
    levelsGained++;
    xpToNextLevel = calculateXpToNextLevel(level);
  }
  
  return {
    newLevel: level,
    newXp: xp,
    newXpToNext: xpToNextLevel,
    levelsGained
  };
}

export function spawnBaby(): Baby {
  const type = BABY_TYPES[Math.floor(Math.random() * BABY_TYPES.length)];
  return {
    ...type,
    currentHp: type.hp,
    maxHp: type.hp,
    instanceId: Date.now()
  };
}

export function createPlayer(name: string): Player {
  const level = 1;
  return {
    id: crypto.randomUUID(),
    name,
    level,
    xp: 0,
    xpToNextLevel: calculateXpToNextLevel(level),
    damage: calculateDamage(level),
    totalDamage: 0,
    clicks: 0,
    kills: 0,
    joinedAt: Date.now()
  };
}

export function createRoom(roomId: string): Room {
  roomLastActivity.set(roomId, Date.now());
  return {
    id: roomId,
    players: new Map(),
    baby: null,
    babySpawnTime: 0,
    totalDamageDealt: 0,
    clients: [],
    lastActivity: Date.now()
  };
}

export function updateRoomActivity(room: Room): void {
  room.lastActivity = Date.now();
  roomLastActivity.set(room.id, Date.now());
}

export async function broadcast(room: Room, data: unknown): Promise<void> {
  const dead: number[] = [];
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  
  await Promise.all(
    room.clients.map(async (client, index) => {
      try {
        await client.writer.write(encoded);
      } catch {
        dead.push(index);
      }
    })
  );
  
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

// Custom validation error class
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Validate player name
export function validatePlayerName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new ValidationError('Name must be a string');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Name cannot be empty');
  }
  if (trimmed.length > 20) {
    throw new ValidationError('Name too long (max 20 characters)');
  }
  // Remove control characters and potential XSS
  const sanitized = trimmed.replace(/[<>"']/g, '');
  return sanitized || 'Игрок';
}

// Validate room ID
export function validateRoomId(roomId: unknown): string {
  if (typeof roomId !== 'string') {
    throw new ValidationError('Invalid room ID');
  }
  const sanitized = roomId.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  if (sanitized.length < 3 || sanitized.length > 20) {
    throw new ValidationError('Invalid room ID length');
  }
  return sanitized;
}