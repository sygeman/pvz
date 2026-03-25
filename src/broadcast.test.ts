import { describe, it, expect } from 'bun:test';
import { createRoom, broadcast, spawnBaby } from './game';
import type { Room } from './types';

describe('SSE Broadcast Tests', () => {
  it('broadcast handles empty clients array', async () => {
    const room = createRoom('TEST_EMPTY');
    
    // Should not throw with no clients
    await broadcast(room, { type: 'test', data: 'hello' });
    expect(room.clients.length).toBe(0);
  });

  it('broadcast removes dead clients and continues', async () => {
    const room = createRoom('TEST_DEAD');
    
    // Create mock writer that throws
    const mockWriter = {
      write: async () => { throw new Error('Connection closed'); },
      close: async () => {}
    };
    
    room.clients.push({
      id: 1,
      writer: mockWriter as any,
      encoder: new TextEncoder()
    });
    
    // Create mock writer that works
    const workingWriter = {
      write: async () => {},
      close: async () => {}
    };
    
    room.clients.push({
      id: 2,
      writer: workingWriter as any,
      encoder: new TextEncoder()
    });
    
    // Should remove dead client and not throw
    await broadcast(room, { type: 'test', baby: spawnBaby() });
    
    // Dead client should be removed
    expect(room.clients.length).toBe(1);
    expect(room.clients[0].id).toBe(2);
  });

  it('broadcast handles multiple messages', async () => {
    const room = createRoom('TEST_MULTI');
    let writeCount = 0;
    
    const mockWriter = {
      write: async () => { writeCount++; },
      close: async () => {}
    };
    
    room.clients.push({
      id: 1,
      writer: mockWriter as any,
      encoder: new TextEncoder()
    });
    
    await broadcast(room, { type: 'event1' });
    await broadcast(room, { type: 'event2' });
    await broadcast(room, { type: 'event3' });
    
    expect(writeCount).toBe(3);
    expect(room.clients.length).toBe(1);
  });

  it('broadcast handles mixed dead and alive clients', async () => {
    const room = createRoom('TEST_MIXED');
    const aliveWrites: string[] = [];
    
    // Add 3 clients: dead, alive, dead
    for (let i = 1; i <= 3; i++) {
      const isDead = i % 2 === 1; // 1 and 3 are dead
      
      const writer = {
        write: async (data: Uint8Array) => {
          if (isDead) throw new Error('Dead');
          aliveWrites.push(new TextDecoder().decode(data));
        },
        close: async () => {}
      };
      
      room.clients.push({
        id: i,
        writer: writer as any,
        encoder: new TextEncoder()
      });
    }
    
    await broadcast(room, { type: 'mixed-test' });
    
    // Only alive client (id=2) should receive message
    expect(aliveWrites.length).toBe(1);
    expect(room.clients.length).toBe(1);
    expect(room.clients[0].id).toBe(2);
  });
});