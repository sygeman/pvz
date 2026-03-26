<template>
  <div class="clicker">
    <!-- Lobby -->
    <div v-if="!connected" class="lobby">
      <h1>🧟‍♀️ БАБЫ-ЗОМБИ</h1>
      <p class="subtitle">PvE Кооперативный Кликер ⚔️</p>
      
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
        
        <p class="hint">Поделись URL чтобы пригласить друзей в кооп</p>
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
        
        <!-- Player Stats -->
        <div class="player-stats">
          <div class="stat level">
            <span class="label">Уровень</span>
            <span class="value">⭐ {{ level }}</span>
          </div>
          <div class="stat xp">
            <span class="label">Опыт</span>
            <div class="xp-bar">
              <div class="xp-fill" :style="{ width: xpPercent + '%' }"></div>
            </div>
            <span class="xp-text">{{ xp }} / {{ xpToNext }}</span>
          </div>
          
          <div class="stat damage">
            <span class="label">Урон</span>
            <span class="value">⚔️ {{ damage }}</span>
          </div>
        </div>
        
        <div class="stats">
          <div class="stat" title="Общий урон (основной счёт)">
            <span class="label">Урон</span>
            <span class="value">⚔️ {{ formatNumber(totalDamage) }}</span>
          </div>
          <div class="stat" title="Количество кликов">
            <span class="label">Клики</span>
            <span class="value">🖱️ {{ formatNumber(clicks) }}</span>
          </div>
          
          <div class="stat" title="Убийств баб">
            <span class="label">Убийства</span>
            <span class="value">💀 {{ kills }}</span>
          </div>
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
              :class="{ 'critical': baby.currentHp / baby.maxHp < 0.2 }"
              :style="{ width: Math.max(0, baby.currentHp / baby.maxHp * 100) + '%' }"
            ></div>
          </div>
          
          <div class="hp-text">{{ formatNumber(Math.max(0, baby.currentHp)) }} / {{ formatNumber(baby.maxHp) }} HP</div>
          
          <div class="reward">💰 +{{ formatNumber(baby.reward) }} XP за убийство</div>
        </div>
        
        <div class="click-hint" v-if="baby.currentHp > 0">
          КЛИКАЙ! Наносишь {{ damage }} урона за клик
        </div>
        <div class="click-hint dead" v-else>🎉 БАБА УБИТА! +{{ lastKillBonus }} XP</div>
      </div>
      
      <!-- Damage Popup -->
      <div v-if="showDamagePopup" class="damage-popup">
        +{{ lastDamage }} урона! +{{ lastXpGained }} XP
      </div>
      
      <!-- Leaderboard -->
      <div class="leaderboard">
        <h3>🏆 Топ дамагеров</h3>
        
        <div class="players">
          <div 
            v-for="(p, i) in sortedPlayers" 
            :key="p.id"
            class="player"
            :class="{ 'me': p.id === playerId }"
          >
            <span class="rank">#{{ i + 1 }}</span>
            <span class="name">⭐{{ p.level }} {{ p.name }}</span>
            <span class="damage">⚔️ {{ formatNumber(p.totalDamage) }}</span>
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
          :class="msg.type"
        >
          {{ msg.text }}
        </div>
      </div>
      
      <!-- Level Up Notification -->
      <div v-if="showLevelUp" class="level-up-notification">
        <div class="level-up-content">
          <div class="level-up-icon">⭐</div>
          <div class="level-up-text">УРОВЕНЬ {{ level }}!</div>
          <div class="level-up-bonus">Урон: {{ damage }} ⚔️</div>
        </div>
      </div>
      
      <!-- Connection Status -->
      <div v-if="!wsConnected" class="connection-status reconnecting">
        ⚠️ Переподключение... ({{ reconnectAttempt }})
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'babies_zombies_session';
const CLICK_COOLDOWN_MS = 50;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const WS_PING_INTERVAL = 15000; // Send pong every 15s

const playerName = ref('');
const roomId = ref('');
const connected = ref(false);
const playerId = ref(null);

// Player progression stats
const level = ref(1);
const xp = ref(0);
const xpToNext = ref(100);
const damage = ref(1);
const totalDamage = ref(0);

// Game stats
const clicks = ref(0);
const kills = ref(0);
const baby = ref(null);
const players = ref([]);

// UI state
const killFeed = ref([]);
const hitEffect = ref(false);
const savedSession = ref(null);
const isInvited = ref(false);
const isLoading = ref(false);
const wsConnected = ref(false);
const reconnectAttempt = ref(0);
const showDamagePopup = ref(false);
const showLevelUp = ref(false);
const lastDamage = ref(0);
const lastXpGained = ref(0);
const lastKillBonus = ref(0);

let ws = null;
let reconnectTimeout = null;
let pingInterval = null;
let lastClickTime = 0;
let damagePopupTimeout = null;
let levelUpTimeout = null;

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => b.totalDamage - a.totalDamage);
});

const xpPercent = computed(() => {
  if (xpToNext.value <= 0) return 100;
  return Math.min(100, Math.max(0, (xp.value / xpToNext.value) * 100));
});

function formatNumber(n) {
  if (typeof n !== 'number') return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString('ru-RU');
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
    addKillFeed('🔗 Ссылка скопирована!', 'info');
  });
}

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
  disconnectWS();
  connected.value = false;
  playerId.value = null;
  level.value = 1;
  xp.value = 0;
  xpToNext.value = 100;
  damage.value = 1;
  totalDamage.value = 0;
  clicks.value = 0;
  kills.value = 0;
  baby.value = null;
  players.value = [];
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function disconnectWS() {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  wsConnected.value = false;
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
      const p = data.player;
      level.value = p.level || 1;
      xp.value = p.xp || 0;
      xpToNext.value = p.xpToNextLevel || 100;
      damage.value = p.damage || 1;
      totalDamage.value = p.totalDamage || 0;
      clicks.value = p.clicks || 0;
      kills.value = p.kills || 0;
    } else {
      playerId.value = data.playerId;
      const p = data.player;
      level.value = p.level || 1;
      xp.value = p.xp || 0;
      xpToNext.value = p.xpToNextLevel || 100;
      damage.value = p.damage || 1;
      totalDamage.value = 0;
      clicks.value = 0;
      kills.value = 0;
    }
    
    baby.value = data.baby;
    connected.value = true;
    
    saveSession();
    connectWS();
  } catch (e) {
    console.error('Join error:', e);
    alert('Ошибка подключения: ' + (e.message || 'Неизвестная ошибка'));
  } finally {
    isLoading.value = false;
  }
}

function connectWS() {
  disconnectWS();
  
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/room/${roomId.value}`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      wsConnected.value = true;
      reconnectAttempt.value = 0;
      
      // Send join message via WS
      ws.send(JSON.stringify({
        type: 'join',
        name: playerName.value,
        playerId: playerId.value
      }));
      
      // Start ping interval
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      }, WS_PING_INTERVAL);
    };
    
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleEvent(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };
    
    ws.onclose = () => {
      wsConnected.value = false;
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      if (connected.value && reconnectAttempt.value < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt.value++;
        const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt.value - 1), 30000);
        
        reconnectTimeout = setTimeout(() => {
          if (connected.value) {
            connectWS();
          }
        }, delay);
      } else if (reconnectAttempt.value >= MAX_RECONNECT_ATTEMPTS) {
        alert('Соединение потеряно. Обновите страницу.');
        exit();
      }
    };
    
    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
      wsConnected.value = false;
    };
  } catch (e) {
    console.error('WS connection error:', e);
    wsConnected.value = false;
  }
}

function handleEvent(data) {
  console.log('[WS Event]', data.type, data);
  if (!data || !data.type) return;
  
  switch(data.type) {
    case 'init':
      baby.value = data.baby;
      players.value = data.players || [];
      const me = data.players?.find(p => p.id === playerId.value);
      if (me) {
        level.value = me.level || 1;
        xp.value = me.xp || 0;
        xpToNext.value = me.xpToNextLevel || 100;
        damage.value = me.damage || 1;
        totalDamage.value = me.totalDamage || 0;
        clicks.value = me.clicks || 0;
        kills.value = me.kills || 0;
      }
      break;
      
    case 'joined':
      if (data.player) {
        playerId.value = data.playerId;
        level.value = data.player.level || 1;
        xp.value = data.player.xp || 0;
        xpToNext.value = data.player.xpToNextLevel || 100;
        damage.value = data.player.damage || 1;
        totalDamage.value = data.player.totalDamage || 0;
        clicks.value = data.player.clicks || 0;
        kills.value = data.player.kills || 0;
      }
      if (data.baby) {
        baby.value = data.baby;
      }
      break;
      
    case 'player-joined':
      players.value = data.players || [];
      break;
      
    case 'baby-damaged':
      if (data.baby) {
        baby.value = data.baby;
      }
      // Show other players' damage in feed
      if (data.attacker?.id !== playerId.value && data.attacker?.name) {
        addKillFeed(`${data.attacker.name} нанёс ${data.damage} урона!`, 'damage');
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
        totalDamage.value = data.killer.totalDamage || totalDamage.value;
        kills.value = data.killer.kills || kills.value;
      }
      
      if (data.killer?.name) {
        lastKillBonus.value = data.bonusXp || 0;
        addKillFeed(`🎉 ${data.killer.name} добил бабу! +${formatNumber(data.bonusXp || 0)} XP`, 'kill');
      }
      break;
      
    case 'player-leveled-up':
      if (data.player?.id === playerId.value) {
        level.value = data.newLevel;
        damage.value = data.player.damage;
        xp.value = data.player.xp;
        xpToNext.value = data.player.xpToNextLevel;
        showLevelUpNotification();
      }
      if (data.player?.name) {
        addKillFeed(`⭐ ${data.player.name} достиг уровня ${data.newLevel}!`, 'levelup');
      }
      break;
      
    case 'click-result':
      // Update local stats from click result
      if (data.killed) {
        totalDamage.value = data.player?.totalDamage || totalDamage.value;
        kills.value = data.player?.kills || kills.value;
        lastKillBonus.value = data.bonusXp || 0;
        if (data.baby) {
          baby.value = data.baby;
        }
      } else {
        if (data.baby) {
          baby.value = data.baby;
        }
      }
      
      // Show damage popup
      lastDamage.value = data.damage || 0;
      lastXpGained.value = data.xpGained || 0;
      showDamagePopup.value = true;
      if (damagePopupTimeout) clearTimeout(damagePopupTimeout);
      damagePopupTimeout = setTimeout(() => {
        showDamagePopup.value = false;
      }, 1000);
      
      // Update XP and check for level up
      if (data.player) {
        xp.value = data.player.xp;
        xpToNext.value = data.player.xpToNextLevel;
        if (data.leveledUp) {
          level.value = data.player.level;
          damage.value = data.player.damage;
          showLevelUpNotification();
        }
      }
      break;
      
    case 'ping':
      // Server ping - respond with pong
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
      break;
  }
}

function showLevelUpNotification() {
  showLevelUp.value = true;
  if (levelUpTimeout) clearTimeout(levelUpTimeout);
  levelUpTimeout = setTimeout(() => {
    showLevelUp.value = false;
  }, 3000);
}

async function clickBaby() {
  console.log('[Click] baby:', baby.value?.currentHp, 'playerId:', playerId.value, 'ws:', ws?.readyState);
  
  if (!baby.value || !playerId.value || !ws) {
    console.log('[Click] Blocked - missing data');
    return;
  }
  
  const now = Date.now();
  if (now - lastClickTime < CLICK_COOLDOWN_MS) {
    return;
  }
  lastClickTime = now;
  
  if (baby.value.currentHp <= 0) {
    return;
  }
  
  hitEffect.value = true;
  setTimeout(() => hitEffect.value = false, 100);
  
  // Send click via WebSocket
  if (ws.readyState === WebSocket.OPEN) {
    const msg = { type: 'click', playerId: playerId.value };
    console.log('[Click] Sending:', msg);
    ws.send(JSON.stringify(msg));
    clicks.value++;
  } else {
    console.log('[Click] WebSocket not open, state:', ws.readyState);
  }
}

function addKillFeed(text, type = 'info') {
  const id = Date.now() + Math.random();
  killFeed.value.unshift({ id, text, type });
  if (killFeed.value.length > 5) killFeed.value.pop();
  setTimeout(() => {
    killFeed.value = killFeed.value.filter(m => m.id !== id);
  }, 4000);
}

onUnmounted(() => {
  disconnectWS();
  if (damagePopupTimeout) clearTimeout(damagePopupTimeout);
  if (levelUpTimeout) clearTimeout(levelUpTimeout);
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

.lobby .subtitle {
  color: #4ecdc4;
  font-size: 1.2rem;
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
  color: #888;
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
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 20px;
}

header .room-info {
  color: #888;
  margin-bottom: 15px;
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

/* Player Stats Bar */
.player-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 15px;
  padding: 15px;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  flex-wrap: wrap;
}

.player-stats .stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.player-stats .stat .label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.player-stats .stat .value {
  font-size: 1.3rem;
  font-weight: bold;
  color: #ffd700;
}

.player-stats .stat.level .value {
  color: #4ecdc4;
}

.player-stats .stat.damage .value {
  color: #ff6b6b;
}

.player-stats .stat.xp {
  min-width: 150px;
}

.xp-bar {
  width: 120px;
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4, #44a08d);
  transition: width 0.3s;
}

.xp-text {
  font-size: 0.75rem;
  color: #888;
}

/* Main Stats */
.stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}

.stats .stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.stats .stat .label {
  font-size: 0.8rem;
  color: #888;
}

.stats .stat .value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
}

.baby-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.baby {
  text-align: center;
  background: rgba(255,255,255,0.05);
  padding: 30px 40px;
  border-radius: 20px;
  border: 2px solid rgba(255,107,107,0.3);
  transition: transform 0.1s, opacity 0.3s;
  min-width: 280px;
}

.baby.dead {
  opacity: 0.6;
  border-color: #666;
}

.baby-container:active .baby:not(.dead) {
  transform: scale(0.95);
}

.emoji {
  font-size: 7rem;
  line-height: 1;
  margin-bottom: 15px;
  transition: transform 0.1s;
}

.emoji.hit {
  transform: scale(1.2) rotate(-10deg);
}

.baby.dead .emoji {
  filter: grayscale(100%);
}

.baby .name {
  font-size: 1.8rem;
  font-weight: bold;
  color: #ff6b6b;
  margin-bottom: 8px;
}

.baby.dead .name {
  color: #666;
}

.baby .desc {
  color: #888;
  margin-bottom: 15px;
  font-size: 0.9rem;
}

.hp-bar {
  width: 100%;
  max-width: 250px;
  height: 24px;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  overflow: hidden;
  margin: 0 auto 10px;
  border: 2px solid rgba(255,255,255,0.1);
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
  50% { opacity: 0.6; }
}

.hp-text {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 12px;
}

.reward {
  font-size: 1rem;
  color: #4ecdc4;
  font-weight: bold;
}

.click-hint {
  margin-top: 20px;
  font-size: 1rem;
  color: #4ecdc4;
  animation: pulse 1s infinite;
  text-align: center;
}

.click-hint.dead {
  color: #ffd700;
  animation: none;
  font-size: 1.2rem;
  font-weight: bold;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Damage Popup */
.damage-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.9);
  color: #ffd700;
  padding: 15px 25px;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  border: 2px solid #ffd700;
  animation: damagePopup 1s forwards;
  z-index: 10;
  pointer-events: none;
}

@keyframes damagePopup {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.8); }
  20% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
}

.leaderboard {
  background: rgba(255,255,255,0.05);
  border-radius: 15px;
  padding: 20px;
  margin-top: 20px;
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
  padding: 12px 15px;
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
  font-size: 0.95rem;
}

.player .damage {
  color: #ff6b6b;
  font-weight: bold;
}

.player .kills {
  color: #ffd700;
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
  max-width: 300px;
}

.kill-feed .message {
  background: rgba(0,0,0,0.85);
  padding: 12px 18px;
  border-radius: 8px;
  border-left: 4px solid #888;
  animation: slideIn 0.3s, fadeOut 0.3s 3.7s forwards;
  font-size: 0.9rem;
}

.kill-feed .message.kill {
  border-left-color: #ff6b6b;
  color: #ff6b6b;
}

.kill-feed .message.levelup {
  border-left-color: #ffd700;
  color: #ffd700;
  font-weight: bold;
}

.kill-feed .message.damage {
  border-left-color: #4ecdc4;
  color: #4ecdc4;
}

.kill-feed .message.info {
  border-left-color: #888;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeOut {
  to { opacity: 0; }
}

/* Level Up Notification */
.level-up-notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 200;
  animation: levelUpPulse 3s forwards;
  pointer-events: none;
}

.level-up-content {
  background: linear-gradient(135deg, rgba(78,205,196,0.9), rgba(68,160,141,0.9));
  padding: 40px 60px;
  border-radius: 20px;
  text-align: center;
  border: 3px solid #ffd700;
  box-shadow: 0 0 50px rgba(78,205,196,0.5);
}

.level-up-icon {
  font-size: 5rem;
  margin-bottom: 10px;
  animation: bounce 0.5s infinite alternate;
}

.level-up-text {
  font-size: 2.5rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  margin-bottom: 10px;
}

.level-up-bonus {
  font-size: 1.3rem;
  color: #ffd700;
}

@keyframes levelUpPulse {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  20% { transform: translate(-50%, -50%) scale(1); }
  85% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes bounce {
  from { transform: scale(1); }
  to { transform: scale(1.2); }
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
  
  .lobby .subtitle {
    font-size: 1rem;
  }
  
  .emoji {
    font-size: 5rem;
  }
  
  .player-stats {
    gap: 15px;
    padding: 12px;
  }
  
  .player-stats .stat.xp {
    min-width: 100px;
  }
  
  .xp-bar {
    width: 80px;
  }
  
  .stats {
    gap: 20px;
  }
  
  .stats .stat .value {
    font-size: 1.2rem;
  }
  
  .saved-session .buttons {
    flex-direction: column;
  }
  
  .baby {
    min-width: auto;
    padding: 20px;
  }
  
  .player {
    grid-template-columns: 30px 1fr auto auto;
    gap: 10px;
    padding: 10px;
  }
  
  .kill-feed {
    left: 10px;
    right: 10px;
    top: 10px;
    max-width: none;
  }
  
  .level-up-content {
    padding: 30px 40px;
  }
  
  .level-up-text {
    font-size: 1.8rem;
  }
}
</style>