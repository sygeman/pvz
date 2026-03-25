<template>
  <div class="game-container">
    <header>
      <div class="user-info">
        <img :src="user.avatar" class="avatar" alt="avatar" />
        <span>{{ user.name }}</span>
        <button @click="logout" class="logout-btn">Выйти</button>
      </div>
      <h1>🏪 КЛАДОВОЧНИК 2.0</h1>
    </header>

    <div class="stats">
      <StatCard label="📅 Месяц" :value="month" />
      <StatCard label="💰 Баланс" :value="formatMoney(money)" />
      <StatCard label="🏪 ПВЗ в городе" :value="cityPvz" />
      <StatCard label="🧟‍♀️ Баб" :value="zombieCounter" />
    </div>

    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="['tab-btn', { active: currentTab === tab.id }]"
      >
        {{ tab.icon }} {{ tab.name }}
      </button>
    </div>

    <div class="content">
      <MarketView v-if="currentTab === 'market'" />
      <StoragesView v-if="currentTab === 'storages'" />
      <EventsView v-if="currentTab === 'events'" />
    </div>

    <div class="actions">
      <button @click="nextMonth" class="btn btn-danger">📅 След. месяц</button>
      <button @click="resetGame" class="btn btn-secondary">🔄 С начала</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useGameStore } from '../store.js';
import { storeToRefs } from 'pinia';
import StatCard from './StatCard.vue';
import MarketView from './MarketView.vue';
import StoragesView from './StoragesView.vue';
import EventsView from './EventsView.vue';

const store = useGameStore();
const { user, money, month, cityPvz, zombieCounter, formatMoney } = storeToRefs(store);

const currentTab = ref('market');

const tabs = [
  { id: 'market', name: 'Рынок', icon: '🏪' },
  { id: 'storages', name: 'Мои кладовки', icon: '📦' },
  { id: 'events', name: 'События', icon: '📢' },
];

function nextMonth() {
  const survived = store.nextMonth();
  if (!survived) {
    currentTab.value = 'events';
  }
}

function resetGame() {
  if (confirm('Начать новую игру? Прогресс будет сброшен.')) {
    store.resetGame();
    store.saveGame();
    currentTab.value = 'market';
  }
}

function logout() {
  store.logout();
}
</script>

<style scoped>
.game-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 20px;
  position: relative;
}

.user-info {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.logout-btn {
  background: transparent;
  border: 1px solid #666;
  color: #888;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.logout-btn:hover {
  color: #fff;
  border-color: #fff;
}

h1 {
  font-size: 2rem;
  color: #ffd700;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

@media (max-width: 600px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .user-info {
    position: static;
    justify-content: center;
    margin-bottom: 20px;
  }
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tab-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: #888;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn.active {
  background: #4ecdc4;
  color: #000;
}

.tab-btn:hover:not(.active) {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.content {
  background: rgba(255,255,255,0.05);
  border-radius: 15px;
  padding: 20px;
  min-height: 300px;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-danger {
  background: #ff6b6b;
  color: #fff;
}

.btn-secondary {
  background: #666;
  color: #fff;
}
</style>
