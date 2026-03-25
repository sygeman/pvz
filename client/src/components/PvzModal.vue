<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <h3>Открыть ПВЗ в кладовке #{{ storageId }}</h3>
      
      <div class="services">
        <div 
          v-for="(service, key) in services" 
          :key="key"
          class="service-card"
          @click="$emit('select', key)"
        >
          <div class="header">
            <span class="name">{{ service.name }}</span>
            <span class="cost">{{ formatMoney(service.cost) }}</span>
          </div>
          <div class="info">
            {{ service.m > 1 ? '🔥 Высокая маржа (+30%)' : service.m < 1 ? '⚠️ Рискованно (-20%)' : '✅ Средний риск' }}
          </div>
        </div>
      </div>
      
      <button @click="$emit('close')" class="close-btn">Отмена</button>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store.js';
import { storeToRefs } from 'pinia';

const props = defineProps({
  storageId: Number
});

const store = useGameStore();
const { formatMoney } = storeToRefs(store);

const services = {
  ozon: { name: "Ozon", cost: 50000, m: 1.0 },
  wb: { name: "Wildberries", cost: 80000, m: 1.3 },
  yandex: { name: "Яндекс.Маркет", cost: 40000, m: 0.8 }
};

defineEmits(['close', 'select']);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #1a1a2e;
  padding: 30px;
  border-radius: 15px;
  max-width: 450px;
  width: 90%;
}

h3 {
  margin-bottom: 20px;
  color: #4ecdc4;
}

.services {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.service-card {
  background: rgba(255,255,255,0.1);
  padding: 15px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.service-card:hover {
  background: rgba(255,255,255,0.15);
  transform: translateX(5px);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.name {
  font-weight: bold;
}

.cost {
  color: #ffd700;
  font-weight: bold;
}

.info {
  font-size: 0.85rem;
  color: #aaa;
}

.close-btn {
  margin-top: 20px;
  width: 100%;
  background: #666;
  color: #fff;
  border: none;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
