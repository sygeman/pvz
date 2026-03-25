<template>
  <div class="storages-view">
    <h3>Мои кладовки ({{ myStorages.length }})</h3>
    
    <div v-if="myStorages.length === 0" class="empty">
      У тебя нет кладовок. Купи на рынке!
    </div>
    
    <div v-else class="storage-grid">
      <div 
        v-for="storage in myStorages" 
        :key="storage.id"
        class="storage-card"
        :class="{ 'has-pvz': storage.service }"
      >
        <div class="card-header">
          <span class="title">Кладовка #{{ storage.id }}</span>
          <span 
            v-if="storage.service"
            class="service-badge"
            :style="{ background: getServiceColor(storage.service) }"
          >
            {{ storage.service }}
          </span>
          <span v-else class="status-empty">ПУСТО</span>
        </div>
        <div class="info">📍 {{ storage.address }}</div>
        <div class="info">📐 {{ storage.area }} м² | Аренда: {{ formatMoney(storage.rent) }}/мес</div>
        <div v-if="storage.service" class="stats">
          <div class="stat">💰 Доход: {{ formatMoney(storage.income) }}/мес</div>
          <div class="stat">⭐ Репутация: {{ storage.rep }}/100</div>
        </div>
        
        <button 
          v-else
          @click="openModal(storage.id)"
          class="open-btn"
          :disabled="storage.area < 15"
        >
          Открыть ПВЗ {{ storage.area < 15 ? '(мало места)' : '' }}
        </button>
      </div>
    </div>
    
    <PvzModal 
      v-if="showPvzModal"
      :storage-id="selectedStorage"
      @close="showPvzModal = false"
      @select="openPvz"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useGameStore } from '../store.js';
import { storeToRefs } from 'pinia';
import PvzModal from './PvzModal.vue';

const store = useGameStore();
const { myStorages, formatMoney, showPvzModal, selectedStorage } = storeToRefs(store);

function getServiceColor(service) {
  const colors = { 'Ozon': '#005bff', 'Wildberries': '#8b00ff', 'Яндекс.Маркет': '#fc0' };
  return colors[service] || '#666';
}

function openModal(id) {
  store.selectedStorage = id;
  store.showPvzModal = true;
}

function openPvz(service) {
  store.openPvz(store.selectedStorage, service);
  store.showPvzModal = false;
}
</script>

<style scoped>
.storages-view h3 {
  margin-bottom: 15px;
  color: #4ecdc4;
}

.empty {
  color: #888;
  text-align: center;
  padding: 40px;
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
}

.storage-card.has-pvz {
  border-color: #4ecdc4;
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

.service-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
}

.status-empty {
  background: #666;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.info {
  font-size: 0.85rem;
  color: #aaa;
  margin-bottom: 5px;
}

.stats {
  margin-top: 10px;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.85rem;
  color: #4ecdc4;
}

.open-btn {
  margin-top: 10px;
  background: #4ecdc4;
  color: #000;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.open-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.open-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
