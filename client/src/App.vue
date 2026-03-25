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
          <button @click="reconnect" class="btn-primary">Продолжить игру</button>
          <button @click="clearSession" class="btn-secondary">Новая игра</button>
        </div>
      </div>
      
      <div v-else class="join-form">
        <input 
          v-model="playerName" 
          placeholder="Твоё имя" 
          @keyup.enter="join"
          maxlength="20"
        />
        <input 
          v-model="roomId" 
          placeholder="Название комнаты" 
          @keyup.enter="join"
          maxlength="20"
        />
        
        <button @click="join" :disabled="!playerName || !roomId">
          Играть
        </button>
      </div>
    </div>
    
    <!-- Game -->
    <div v-else class="game">
      <header>
        <div class="room-info">
          Комната: {{ roomId }}
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
        <div class="baby">
          <div class="emoji" :class="{ 'hit': hitEffect }">{{ baby.emoji }}</div>
          <div class="name">{{ baby.name }}</div>
          <div class="desc">{{ baby.desc }}</div>
          
          <div class="hp-bar">
            <div 
              class="hp-fill" 
              :style="{ width: (baby.currentHp / baby.maxHp * 100) + '%' }"
            ></div>
          </div>
          
          <div class="hp-text">{{ baby.currentHp }} / {{ baby.maxHp }} HP</div>
          
          <div class="reward">💰 {{ formatMoney(baby.reward) }}</div>
        </div>
        
        <div class="click-hint">КЛИКАЙ БЫСТРЕЕ!</div>
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'babies_zombies_session';

const playerName = ref('');
const roomId = ref('default');
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

let eventSource = null;

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => b.money - a.money);
});

function formatMoney(m) {
  return m.toLocaleString('ru-RU');
}

// Load saved session on mount
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      savedSession.value = JSON.parse(saved);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
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
}

function exit() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  connected.value = false;
  playerId.value = null;
  // Don't clear localStorage — allow reconnect
}

async function reconnect() {
  if (!savedSession.value) return;
  
  playerId.value = savedSession.value.playerId;
  playerName.value = savedSession.value.playerName;
  roomId.value = savedSession.value.roomId;
  
  try {
    const res = await fetch(`/api/room/${roomId.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: playerName.value,
        playerId: playerId.value 
      })
    });
    
    const data = await res.json();
    
    if (data.reconnected) {
      // Restore stats
      money.value = data.player.money;
      clicks.value = data.player.clicks;
      kills.value = data.player.kills;
    } else {
      // New player ID assigned
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
    alert('Ошибка подключения');
    clearSession();
  }
}

async function join() {
  if (!playerName.value || !roomId.value) return;
  
  try {
    const res = await fetch(`/api/room/${roomId.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName.value })
    });
    
    const data = await res.json();
    playerId.value = data.playerId;
    money.value = data.player.money;
    clicks.value = data.player.clicks;
    kills.value = data.player.kills;
    baby.value = data.baby;
    
    connected.value = true;
    
    saveSession();
    connectSSE();
  } catch (e) {
    alert('Ошибка подключения');
  }
}

function connectSSE() {
  eventSource = new EventSource(`/api/room/${roomId.value}/events`);
  
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    handleEvent(data);
  };
  
  eventSource.onerror = () => {
    // Auto-reconnect will happen
  };
}

function handleEvent(data) {
  switch(data.type) {
    case 'init':
      baby.value = data.baby;
      players.value = data.players;
      // Update our stats from server
      const me = data.players.find(p => p.id === playerId.value);
      if (me) {
        money.value = me.money;
        clicks.value = me.clicks;
        kills.value = me.kills;
      }
      break;
      
    case 'player-joined':
      players.value = data.players;
      break;
      
    case 'baby-damaged':
      baby.value = data.baby;
      break;
      
    case 'baby-killed':
      baby.value = data.newBaby;
      players.value = data.players;
      
      if (data.killer.id === playerId.value) {
        money.value = data.killer.money;
        kills.value = data.killer.kills;
      }
      
      addKillFeed(`${data.killer.name} убил бабу и получил ${formatMoney(data.reward)}₽!`);
      break;
  }
}

async function clickBaby() {
  if (!baby.value || !playerId.value) return;
  
  hitEffect.value = true;
  setTimeout(() => hitEffect.value = false, 100);
  
  try {
    const res = await fetch(`/api/room/${roomId.value}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerId.value, damage: 1 })
    });
    
    const data = await res.json();
    
    if (data.killed) {
      money.value = data.player.money;
      kills.value = data.player.kills;
      baby.value = data.baby;
    } else {
      baby.value = data.baby;
    }
    
    clicks.value++;
  } catch (e) {
    console.error('Click failed:', e);
  }
}

function addKillFeed(text) {
  const id = Date.now();
  killFeed.value.unshift({ id, text });
  if (killFeed.value.length > 5) killFeed.value.pop();
  setTimeout(() => {
    killFeed.value = killFeed.value.filter(m => m.id !== id);
  }, 3000);
}

onUnmounted(() => {
  if (eventSource) eventSource.close();
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

.saved-session button:hover {
  transform: translateY(-2px);
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
  max-width: 300px;
}

.join-form input {
  padding: 15px;
  border: none;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  color: #fff;
  font-size: 1rem;
}

.join-form input:focus {
  outline: 2px solid #ff6b6b;
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

.room-info {
  color: #888;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
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
  transition: transform 0.1s;
}

.baby-container:active .baby {
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

.name {
  font-size: 2rem;
  font-weight: bold;
  color: #ff6b6b;
  margin-bottom: 10px;
}

.desc {
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

.rank {
  font-weight: bold;
  color: #888;
}

.name {
  font-weight: 500;
}

.money {
  color: #ffd700;
}

.kills {
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
}

.message {
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
}
</style>
