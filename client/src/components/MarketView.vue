<template>
  <div class="market-view">
    <h3>Доступные кладовки</h3>
    
    <div class="storage-grid">
      <div 
        v-for="storage in availableStorages" 
        :key="storage.id"
        class="storage-card"
        @click="buy(storage.id)"
      >
        <div class="card-header">
          <span class="title">Кладовка #{{ storage.id }}</span>
          <span class="price">{{ formatMoney(storage.price) }}</span>
        </div>
        <div class="info">📍 {{ storage.address }}</div>
        <div class="info">📐 {{ storage.area }} м² | Аренда: {{ formatMoney(storage.rent) }}/мес</div>
        <div class="buy-hint">Нажми чтобы купить</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGameStore } from '../store.js';
import { storeToRefs } from 'pinia';

const store = useGameStore();
const { availableStorages, formatMoney } = storeToRefs(store);

function buy(id) {
  const success = store.buyStorage(id);
  if (!success) {
    alert('Недостаточно денег!');
  }
}
</script>

<style scoped>
.market-view h3 {
  margin-bottom: 15px;
  color: #4ecdc4;
}

.storage-grid {
  display: grid;
  gap: 10px;
}

.storage-card {
  background: rgba(255,255,255,0.1);
  padding: 15px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.storage-card:hover {
  background: rgba(255,255,255,0.15);
  transform: translateX(5px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.title {
  font-weight: bold;
}

.price {
  color: #ffd700;
  font-weight: bold;
}

.info {
  font-size: 0.85rem;
  color: #aaa;
  margin-bottom: 5px;
}

.buy-hint {
  font-size: 0.8rem;
  color: #4ecdc4;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.storage-card:hover .buy-hint {
  opacity: 1;
}
</style>
