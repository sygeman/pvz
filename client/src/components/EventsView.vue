<template>
  <div class="events-view">
    <h3>История событий</h3>
    
    <div v-if="events.length === 0" class="empty">
      Пока ничего не произошло. Нажми "След. месяц" чтобы начать!
    </div>
    
    <div v-else class="events-list">
      <div 
        v-for="(event, i) in [...events].reverse()" 
        :key="i"
        class="event"
        :class="'event-' + event.type"
      >
        <div class="text">{{ event.text }}</div>
        <div v-if="event.desc" class="desc">{{ event.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store.js';
import { storeToRefs } from 'pinia';

const store = useGameStore();
const { events } = storeToRefs(store);
</script>

<style scoped>
.events-view h3 {
  margin-bottom: 15px;
  color: #4ecdc4;
}

.empty {
  color: #888;
  text-align: center;
  padding: 40px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event {
  padding: 12px 15px;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  border-left: 4px solid #666;
}

.event-baby {
  border-left-color: #ff6b6b;
}

.event-good {
  border-left-color: #4ecdc4;
}

.event-bad {
  border-left-color: #ffd700;
}

.event-info {
  border-left-color: #888;
}

.event-bankrupt {
  border-left-color: #ff0000;
  background: rgba(255,0,0,0.1);
}

.text {
  font-weight: 500;
}

.desc {
  font-size: 0.85rem;
  color: #aaa;
  margin-top: 5px;
}
</style>
