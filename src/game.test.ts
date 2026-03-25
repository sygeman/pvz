import { describe, it, expect, beforeEach } from 'bun:test';
import {
  BABY_TYPES,
  calculateXpToNextLevel,
  calculateDamage,
  calculateLevelUp,
  spawnBaby,
  createPlayer,
  createRoom,
  validatePlayerName,
  validateRoomId
} from './game';
import type { Room } from './types';

describe('Game Logic Tests', () => {
  describe('Progression Formulas', () => {
    it('calculateXpToNextLevel: level 1 = 100 XP', () => {
      expect(calculateXpToNextLevel(1)).toBe(100);
    });

    it('calculateXpToNextLevel: level 2 = 150 XP', () => {
      expect(calculateXpToNextLevel(2)).toBe(150);
    });

    it('calculateXpToNextLevel: level 3 = 225 XP', () => {
      expect(calculateXpToNextLevel(3)).toBe(225);
    });

    it('calculateDamage: level 1 = 1 damage', () => {
      expect(calculateDamage(1)).toBe(1);
    });

    it('calculateDamage: level 2 = 1 damage (floor)', () => {
      expect(calculateDamage(2)).toBe(1);
    });

    it('calculateDamage: level 3 = 2 damage', () => {
      expect(calculateDamage(3)).toBe(2);
    });

    it('calculateDamage: level 5 = 3 damage', () => {
      expect(calculateDamage(5)).toBe(3);
    });

    it('calculateLevelUp: single level up', () => {
      const result = calculateLevelUp(1, 100, 100);
      expect(result.levelsGained).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(result.newXp).toBe(0);
    });

    it('calculateLevelUp: multiple levels up', () => {
      const result = calculateLevelUp(1, 300, 100); // Enough for 2 levels
      expect(result.levelsGained).toBe(2);
      expect(result.newLevel).toBe(3);
    });

    it('calculateLevelUp: no level up', () => {
      const result = calculateLevelUp(1, 50, 100);
      expect(result.levelsGained).toBe(0);
      expect(result.newLevel).toBe(1);
      expect(result.newXp).toBe(50);
    });
  });

  describe('Baby Spawning', () => {
    it('spawnBaby returns valid baby', () => {
      const baby = spawnBaby();
      expect(baby).toBeDefined();
      expect(baby.id).toBeDefined();
      expect(baby.name).toBeDefined();
      expect(baby.hp).toBeGreaterThan(0);
      expect(baby.currentHp).toBe(baby.hp);
      expect(baby.maxHp).toBe(baby.hp);
      expect(baby.instanceId).toBeGreaterThan(0);
    });

    it('spawnBaby creates one of known types', () => {
      const baby = spawnBaby();
      const knownTypes = BABY_TYPES.map(t => t.id);
      expect(knownTypes).toContain(baby.id);
    });
  });

  describe('Player Creation', () => {
    it('createPlayer creates player with level 1', () => {
      const player = createPlayer('Test');
      expect(player.name).toBe('Test');
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.xpToNextLevel).toBe(100);
      expect(player.damage).toBe(1);
      expect(player.totalDamage).toBe(0);
      expect(player.clicks).toBe(0);
      expect(player.kills).toBe(0);
      expect(player.id).toBeDefined();
      expect(player.joinedAt).toBeGreaterThan(0);
    });
  });

  describe('Room Creation', () => {
    it('createRoom creates empty room', () => {
      const room = createRoom('TEST1');
      expect(room.id).toBe('TEST1');
      expect(room.players.size).toBe(0);
      expect(room.clients.length).toBe(0);
      expect(room.baby).toBeNull();
      expect(room.lastActivity).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('validatePlayerName: valid name', () => {
      expect(validatePlayerName('John')).toBe('John');
    });

    it('validatePlayerName: trims whitespace', () => {
      expect(validatePlayerName('  John  ')).toBe('John');
    });

    it('validatePlayerName: removes dangerous chars', () => {
      expect(validatePlayerName('<XSS>')).toBe('XSS');
    });

    it('validatePlayerName: empty throws', () => {
      expect(() => validatePlayerName('')).toThrow();
    });

    it('validatePlayerName: too long throws', () => {
      expect(() => validatePlayerName('a'.repeat(21))).toThrow();
    });

    it('validateRoomId: valid ID uppercase', () => {
      expect(validateRoomId('ABC123')).toBe('ABC123');
    });

    it('validateRoomId: sanitizes invalid chars', () => {
      expect(validateRoomId('abc@#$123')).toBe('ABC123');
    });

    it('validateRoomId: too short throws', () => {
      expect(() => validateRoomId('AB')).toThrow();
    });

    it('validateRoomId: too long throws', () => {
      expect(() => validateRoomId('A'.repeat(21))).toThrow();
    });
  });
});