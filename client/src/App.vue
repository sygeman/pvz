<template>
  <div class="clicker">
    <!-- Lobby -->
    <div v-if="!connected" class="lobby">
      <h1>🧟‍♀️ БАБЫ-ЗОМБИ</h1>
      <p>Мультиплеер кликер</p>
      
      <div v-if="savedSession" class="saved-session">
        <p>Привет, <strong>{{ savedSession.playerName }}</strong>!</p>
        <p>Комната: {{ savedSession.roomId }}</p>
        <div class="buttons">
          <button @click="reconnect" :disabled="isLoading" class="btn-primary">
            {{ isLoading ? 'Подключение...' : 'Продолжить игру' }}
          </button>
          <button @click="clearSession" :disabled="isLoading" class="btn-secondary">Новая игра</button>
        </div>
      </div>
      
      <div v-else class="join-form">
        <div v-if="isInvited" class="invite-banner">
          <p>🎮 Тебя пригласили в комнату <strong>{{ roomId }}</strong>!</p>
        </div>
        
        <input 
          v-model="playerName" 
          placeholder="Твоё имя" 
          @keyup.enter="join"
          maxlength="20"
          :disabled="isLoading"
        />
        
        <div class="room-info">
          <span>Комната: <strong>{{ roomId }}</strong></span>
          <button @click="generateRoomId" :disabled="isLoading" class="btn-small" title="Сгенерировать новую">🔄</button>
        </div>
        
        <button @click="join" :disabled="!playerName || isLoading">
          {{ isLoading ? 'Подключение...' : 'Играть' }}
        </button>
        
        <p class="hint">Поделись URL чтобы пригласить друзей</p>
      </div>
    </div>
    
    <!-- Game -->
    <div v-else class="game">
      <header>
        <div class="room-info">
          <span>Комната: <strong>{{ roomId }}</strong></span>
          <button @click="copyLink" class="btn-small" title="Копировать ссылку">📋</button>
          <button @click="exit" class="exit-btn">Выйти</button>
        </div>
        <div class="stats">
          <div class="stat">💰 {{ formatMoney(money) }}</div>
          <div class="stat">🖱️ {{ clicks }}</div>
          <div class="stat">💀 {{ kills }}</div>
        </div>
      </header>
      
      <!-- Baby Target -->
      <div v-if="baby" class="baby-container" @click="clickBaby">
        <div class="baby" :class="{ 'dead': baby.currentHp <= 0 }">
          <div class="emoji" :class="{ 'hit': hitEffect }">{{ baby.emoji }}</div>
          <div class="name">{{ baby.name }}</div>
          <div class="desc">{{ baby.desc }}</div>
          
          <div class="hp-bar">
            <div 
              class="hp-fill" 
              :class="{ 'critical': baby.currentHp / baby.maxHp < 0.3 }"
              :style="{ width: Math.max(0, baby.currentHp / baby.maxHp * 100) + '%' }"
            ></div>
          </div>
          
          <div class="hp-text">{{ Math.max(0, baby.currentHp) }} / {{ baby.maxHp }} HP</div>
          
          <div class="reward">💰 {{ formatMoney(baby.reward) }}</div>
        </div>
        
        <div class="click-hint" v-if="baby.currentHp > 0">КЛИКАЙ БЫСТРЕЕ!</div>
        <div class="click-hint dead" v-else>БАБА УБИТА!</div>
      </div>
      
      <!-- Leaderboard -->
      <div class="leaderboard">
        <h3>🏆 Топ игроков</h3>
        
        <div class="players">
          <div 
            v-for="(p, i) in sortedPlayers" 
            :key="p.id"
            class="player"
            :class="{ 'me': p.id === playerId }"
          >
            <span class="rank">#{{ i + 1 }}</span>
            <span class="name">{{ p.name }}</span>
            <span class="money">💰 {{ formatMoney(p.money) }}</span>
            <span class="kills">💀 {{ p.kills }}</span>
          </div>
        </div>
      </div>
      
      <!-- Kill Feed -->
      <div class="kill-feed">
        <div 
          v-for="msg in killFeed" 
          :key="msg.id"
          class="message"
        >
          {{ msg.text }}
        </div>
      </div>
      
      <!-- Connection Status -->
      <div v-if="!sseConnected" class="connection-status reconnecting">
        ⚠️ Переподключение... ({{ reconnectAttempt }})
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'babies_zombies_session';
const CLICK_COOLDOWN_MS = 50; // Min time between clicks
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;

const playerName = ref('');
const roomId = ref('');
const connected = ref(false);
const playerId = ref(null);
const money = ref(0);
const clicks = ref(0);
const kills = ref(0);
const baby = ref(null);
const players = ref([]);
const killFeed = ref([]);
const hitEffect = ref(false);
const savedSession = ref(null);
const isInvited = ref(false);
const isLoading = ref(false);
const sseConnected = ref(false);
const reconnectAttempt = ref(0);

let eventSource = null;
let reconnectTimeout = null;
let lastClickTime = 0;

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => b.money - a.money);
});

function formatMoney(m) {
  if (typeof m !== 'number') return '0';
  return m.toLocaleString('ru-RU');
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  roomId.value = result;
  
  const url = new URL(window.location.href);
  url.searchParams.set('room', result);
  window.history.replaceState({}, '', url);
}

function copyLink() {
  const url = `${window.location.origin}/?room=${roomId.value}`;
  navigator.clipboard.writeText(url).then(() => {
    showNotification('Ссылка скопирована!');
  }).catch(() => {
    alert('Ссылка скопирована!');
  });
}

function showNotification(text) {
  // Simple in-app notification instead of alert
  addKillFeed(text);
}

// Load saved session or URL params on mount
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get('room');
  
  if (urlRoom && urlRoom.length >= 3) {
    roomId.value = urlRoom.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.roomId === roomId.value) {
          savedSession.value = session;
        } else {
          isInvited.value = true;
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        isInvited.value = true;
      }
    } else {
      isInvited.value = true;
    }
  } else {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved);
        savedSession.value = session;
        roomId.value = session.roomId;
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        generateRoomId();
      }
    } else {
      generateRoomId();
    }
  }
});

function saveSession() {
  if (playerId.value && playerName.value && roomId.value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      playerId: playerId.value,
      playerName: playerName.value,
      roomId: roomId.value
    }));
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  savedSession.value = null;
  generateRoomId();
}

function exit() {
  disconnectSSE();
  connected.value = false;
  playerId.value = null;
  money.value = 0;
  clicks.value = 0;
  kills.value = 0;
  baby.value = null;
  players.value = [];
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  sseConnected.value = false;
  reconnectAttempt.value = 0;
}

async function reconnect() {
  if (!savedSession.value) return;
  
  playerId.value = savedSession.value.playerId;
  playerName.value = savedSession.value.playerName;
  roomId.value = savedSession.value.roomId;
  
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId.value);
  window.history.replaceState({}, '', url);
  
  await doJoin();
}

async function join() {
  if (!playerName.value || !roomId.value || isLoading.value) return;
  
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId.value);
  window.history.replaceState({}, '', url);
  
  await doJoin();
}

async function doJoin() {
  isLoading.value = true;
  
  try {
    const res = await fetch(`/api/room/${roomId.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: playerName.value,
        playerId: playerId.value 
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (data.reconnected) {
      money.value = data.player.money || 0;
      clicks.value = data.player.clicks || 0;
      kills.value = data.player.kills || 0;
    } else {
      playerId.value = data.playerId;
      money.value = 0;
      clicks.value = 0;
      kills.value = 0;
    }
    
    baby.value = data.baby;
    connected.value = true;
    
    saveSession();
    connectSSE();
  } catch (e) {
    console.error('Join error:', e);
    alert('Ошибка подключения: ' + (e.message || 'Неизвестная ошибка'));
  } finally {
    isLoading.value = false;
  }
}

function connectSSE() {
  disconnectSSE();
  
  try {
    eventSource = new EventSource(`/api/room/${roomId.value}/events`);
    sseConnected.value = true;
    reconnectAttempt.value = 0;
    
    eventSource.onopen = () => {
      sseConnected.value = true;
      reconnectAttempt.value = 0;
    };
    
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };
    
    eventSource.onerror = () => {
      sseConnected.value = false;
      
      if (reconnectAttempt.value < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt.value++;
        const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt.value - 1), 30000);
        
        reconnectTimeout = setTimeout(() => {
          if (connected.value) {
            connectSSE();
          }
        }, delay);
      } else {
        alert('Соединение потеряно. Обновите страницу.');
        exit();
      }
    };
  } catch (e) {
    console.error('SSE connection error:', e);
    sseConnected.value = false;
  }
}

function handleEvent(data) {
  if (!data || !data.type) return;
  
  switch(data.type) {
    case 'init':
      baby.value = data.baby;
      players.value = data.players || [];
      const me = data.players?.find(p => p.id === playerId.value);
      if (me) {
        money.value = me.money || 0;
        clicks.value = me.clicks || 0;
        kills.value = me.kills || 0;
      }
      break;
      
    case 'player-joined':
      players.value = data.players || [];
      break;
      
    case 'baby-damaged':
      if (data.baby) {
        baby.value = data.baby;
      }
      break;
      
    case 'baby-killed':
      if (data.newBaby) {
        baby.value = data.newBaby;
      }
      if (data.players) {
        players.value = data.players;
      }
      
      if (data.killer?.id === playerId.value) {
        money.value = data.killer.money || 0;
        kills.value = data.killer.kills || 0;
      }
      
      if (data.killer?.name) {
        const reward = data.reward || 0;
        addKillFeed(`${data.killer.name} убил бабу и получил ${formatMoney(reward)}₽! 💀`);
      }
      break;
  }
}

async function clickBaby() {
  if (!baby.value || !playerId.value) return;
  
  // Rate limiting
  const now = Date.now();
  if (now - lastClickTime < CLICK_COOLDOWN_MS) {
    return; // Ignore rapid clicks
  }
  lastClickTime = now;
  
  // Don't click dead babies
  if (baby.value.currentHp <= 0) {
    return;
  }
  
  hitEffect.value = true;
  setTimeout(() => hitEffect.value = false, 100);
  
  try {
    const res = await fetch(`/api/room/${roomId.value}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerId.value, damage: 1 })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.error) {
      console.warn('Click error:', data.error);
      return;
    }
    
    if (data.killed) {
      money.value = data.player?.money || money.value;
      kills.value = data.player?.kills || kills.value;
      if (data.baby) {
        baby.value = data.baby;
      }
    } else {
      if (data.baby) {
        baby.value = data.baby;
      }
    }
    
    clicks.value++;
  } catch (e) {
    console.error('Click failed:', e);
  }
}

function addKillFeed(text) {
  const id = Date.now() + Math.random();
  killFeed.value.unshift({ id, text });
  if (killFeed.value.length > 5) killFeed.value.pop();
  setTimeout(() => {
    killFeed.value = killFeed.value.filter(m => m.id !== id);
  }, 3000);
}

onUnmounted(() => {
  disconnectSSE();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.clicker {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  padding: 20px;
}

.lobby h1 {
  font-size: 3rem;
  color: #ff6b6b;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  margin-bottom: 10px;
}

.lobby p {
  color: #888;
  margin-bottom: 40px;
}

.saved-session {
  background: rgba(255,255,255,0.1);
  padding: 30px;
  border-radius: 15px;
  margin-bottom: 20px;
}

.saved-session p {
  margin-bottom: 10px;
}

.saved-session .buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.saved-session button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.btn-primary {
  background: #ff6b6b;
  color: #fff;
}

.btn-secondary {
  background: #666;
  color: #fff;
}

.saved-session button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.saved-session button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
  max-width: 300px;
}

.invite-banner {
  background: rgba(78, 205, 196, 0.2);
  border: 1px solid #4ecdc4;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.invite-banner p {
  color: #4ecdc4;
  margin: 0;
}

.invite-banner strong {
  color: #fff;
  font-family: monospace;
  font-size: 1.2rem;
}

.join-form input {
  padding: 15px;
  border: none;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  color: #fff;
  font-size: 1rem;
  text-align: center;
}

.join-form input:focus {
  outline: 2px solid #ff6b6b;
}

.join-form input::placeholder {
  color: #666;
}

.join-form input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.room-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  font-size: 1.1rem;
}

.room-info strong {
  color: #4ecdc4;
  font-family: monospace;
  font-size: 1.3rem;
  letter-spacing: 2px;
}

.btn-small {
  background: transparent;
  border: 1px solid #666;
  color: #888;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-small:hover:not(:disabled) {
  color: #fff;
  border-color: #fff;
}

.btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  color: #666;
  font-size: 0.85rem;
  margin-top: 10px;
}

.join-form button {
  padding: 15px;
  border: none;
  border-radius: 8px;
  background: #ff6b6b;
  color: #fff;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.join-form button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255,107,107,0.3);
}

.join-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.game {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 20px;
}

header .room-info {
  color: #888;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

header .room-info strong {
  color: #4ecdc4;
}

.exit-btn {
  background: transparent;
  border: 1px solid #666;
  color: #888;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.exit-btn:hover {
  color: #fff;
  border-color: #fff;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 30px;
}

.stat {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
}

.baby-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  cursor: pointer;
  user-select: none;
}

.baby {
  text-align: center;
  background: rgba(255,255,255,0.05);
  padding: 40px;
  border-radius: 20px;
  border: 2px solid rgba(255,107,107,0.3);
  transition: transform 0.1s, opacity 0.3s;
}

.baby.dead {
  opacity: 0.6;
  border-color: #666;
}

.baby-container:active .baby:not(.dead) {
  transform: scale(0.95);
}

.emoji {
  font-size: 8rem;
  line-height: 1;
  margin-bottom: 20px;
  transition: transform 0.1s;
}

.emoji.hit {
  transform: scale(1.2) rotate(-10deg);
}

.baby.dead .emoji {
  filter: grayscale(100%);
}

.baby .name {
  font-size: 2rem;
  font-weight: bold;
  color: #ff6b6b;
  margin-bottom: 10px;
}

.baby.dead .name {
  color: #666;
}

.baby .desc {
  color: #888;
  margin-bottom: 20px;
}

.hp-bar {
  width: 200px;
  height: 20px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  overflow: hidden;
  margin: 0 auto 10px;
}

.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ffd700);
  transition: width 0.1s;
}

.hp-fill.critical {
  background: linear-gradient(90deg, #ff0000, #ff6b6b);
  animation: pulse-critical 0.5s infinite;
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.hp-text {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 15px;
}

.reward {
  font-size: 1.5rem;
  color: #ffd700;
  font-weight: bold;
}

.click-hint {
  margin-top: 30px;
  font-size: 1.2rem;
  color: #4ecdc4;
  animation: pulse 1s infinite;
}

.click-hint.dead {
  color: #666;
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.leaderboard {
  background: rgba(255,255,255,0.05);
  border-radius: 15px;
  padding: 20px;
  margin-top: 30px;
}

.leaderboard h3 {
  text-align: center;
  margin-bottom: 15px;
  color: #ffd700;
}

.players {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player {
  display: grid;
  grid-template-columns: 40px 1fr auto auto;
  gap: 15px;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.player.me {
  background: rgba(78,205,196,0.2);
  border: 1px solid #4ecdc4;
}

.player .rank {
  font-weight: bold;
  color: #888;
}

.player .name {
  font-weight: 500;
}

.player .money {
  color: #ffd700;
}

.player .kills {
  color: #ff6b6b;
}

.kill-feed {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  z-index: 100;
}

.kill-feed .message {
  background: rgba(0,0,0,0.8);
  padding: 10px 20px;
  border-radius: 8px;
  border-left: 4px solid #ffd700;
  animation: slideIn 0.3s, fadeOut 0.3s 2.7s forwards;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeOut {
  to { opacity: 0; }
}

.connection-status {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: #ffd700;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  z-index: 100;
}

.connection-status.reconnecting {
  animation: pulse 1s infinite;
}

@media (max-width: 600px) {
  .lobby h1 {
    font-size: 2rem;
  }
  
  .emoji {
    font-size: 5rem;
  }
  
  .stats {
    gap: 15px;
  }
  
  .stat {
    font-size: 1.2rem;
  }
  
  .saved-session .buttons {
    flex-direction: column;
  }
  
  .kill-feed {
    left: 10px;
    right: 10px;
    top: 10px;
  }
  
  .kill-feed .message {
    font-size: 0.9rem;
  }
}
</style>