import type { Baby, BabyType, Player, Room } from './types';

export const BABY_TYPES: BabyType[] = [
  { id: 'galya', name: 'Тётя Галя', hp: 10, reward: 100, emoji: '👵', desc: '50 заказов, 1 чехол' },
  { id: 'babushka', name: 'Бабушка', hp: 15, reward: 150, emoji: '👵', desc: '30 пар тапочек' },
  { id: 'mamochka', name: 'Мамочка', hp: 20, reward: 200, emoji: '👩‍🍼', desc: '25 позиций, ничего не взяла' },
  { id: 'shopogolik', name: 'Шопоголик', hp: 25, reward: 300, emoji: '💅', desc: '40 позиций по акциям' },
  { id: 'mega', name: 'МЕГА-БАБА', hp: 100, reward: 1000, emoji: '🧟‍♀️', desc: 'BOSS: 100 заказов!' }
];

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
  return {
    id: roomId,
    players: new Map(),
    baby: null,
    babySpawnTime: 0,
    clients: []
  };
}

export function broadcast(room: Room, data: unknown): void {
  const dead: WritableStreamDefaultWriter<string>[] = [];
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  room.clients.forEach(client => {
    try {
      client.write(message);
    } catch {
      dead.push(client);
    }
  });
  
  room.clients = room.clients.filter(c => !dead.includes(c));
}