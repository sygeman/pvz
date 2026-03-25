// Types for the game
export interface BabyType {
  id: string;
  name: string;
  hp: number;
  reward: number;
  emoji: string;
  desc: string;
}

export interface Baby extends BabyType {
  currentHp: number;
  maxHp: number;
  instanceId: number;
}

export interface Player {
  id: string;
  name: string;
  clicks: number;
  money: number;
  kills: number;
  joinedAt: number;
}

export interface ClientConnection {
  id: number;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
}

export interface Room {
  id: string;
  players: Map<string, Player>;
  baby: Baby | null;
  babySpawnTime: number;
  clients: ClientConnection[];
  lastActivity: number;
}

export interface JoinRequest {
  name: string;
  playerId?: string;
}

export interface ClickRequest {
  playerId: string;
  damage?: number;
}

export type ServerEvent =
  | { type: 'init'; baby: Baby | null; players: Player[] }
  | { type: 'player-joined'; player: Player; players: Player[] }
  | { type: 'player-left'; playerId: string; players: Player[] }
  | { type: 'baby-damaged'; baby: Baby; attacker: Player }
  | { type: 'baby-killed'; killer: Player; reward: number; newBaby: Baby; players: Player[] };