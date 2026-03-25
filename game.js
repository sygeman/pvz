// Multiplayer Client for Кладовочник
const socket = io();

let gameState = {
  roomId: null,
  playerId: null,
  playerName: null,
  market: [],
  players: {},
  cityPvz: 12,
  month: 1,
  messages: []
};

// Join room on load
function joinRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room') || 'default';
  const playerName = urlParams.get('name') || 'Игрок' + Math.floor(Math.random() * 1000);
  
  gameState.roomId = roomId;
  gameState.playerName = playerName;
  
  socket.emit('join-room', { roomId, playerName });
  
  document.getElementById('room-info').textContent = `Комната: ${roomId}`;
  document.getElementById('player-name').textContent = playerName;
}

// Socket event handlers
socket.on('room-joined', (data) => {
  gameState.playerId = data.playerId;
  gameState.market = data.market;
  gameState.players = data.players;
  gameState.cityPvz = data.cityPvz;
  gameState.month = data.month;
  gameState.messages = data.messages;
  
  updateUI();
  renderMarket();
  renderPlayers();
  renderChat();
});

socket.on('player-joined', (data) => {
  gameState.players[data.player.id] = data.player;
  renderPlayers();
  addSystemMessage(`${data.player.name} присоединился`);
});

socket.on('player-left', (data) => {
  delete gameState.players[data.playerId];
  renderPlayers();
  addSystemMessage(`${data.playerName} вышел`);
});

socket.on('storage-bought', (data) => {
  gameState.market = data.market;
  gameState.players = data.players;
  renderMarket();
  renderPlayers();
});

socket.on('pvz-opened', (data) => {
  gameState.players = data.players;
  gameState.market = data.market;
  renderMarket();
  renderPlayers();
});

socket.on('month-result', (data) => {
  const player = data.player;
  gameState.players[gameState.playerId] = player;
  gameState.cityPvz = data.cityPvz;
  gameState.month = data.month;
  
  renderEvents(data.events);
  updateUI();
  renderPlayers();
  
  if (player.bankrupt) {
    showBankrupt();
  }
});

socket.on('player-turn', (data) => {
  addSystemMessage(`${data.playerName} завершил месяц ${data.month}`);
});

socket.on('new-message', (msg) => {
  gameState.messages.push(msg);
  renderChat();
});

socket.on('buy-failed', (data) => {
  alert(data.reason);
});

// UI Functions
function updateUI() {
  const player = gameState.players[gameState.playerId];
  if (!player) return;
  
  document.getElementById('month').textContent = gameState.month;
  document.getElementById('money').textContent = formatMoney(player.money);
  document.getElementById('city-pvz').textContent = gameState.cityPvz;
  document.getElementById('zombies').textContent = player.zombieCounter;
}

function formatMoney(m) {
  return m.toLocaleString('ru-RU') + ' ₽';
}

function renderMarket() {
  const list = document.getElementById('market-list');
  list.innerHTML = '';
  
  gameState.market.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card' + (s.owner ? ' disabled' : '');
    
    let ownerText = '';
    if (s.owner) {
      const owner = gameState.players[s.owner];
      ownerText = owner ? `👤 ${owner.name}` : 'Занято';
    }
    
    let serviceBadge = '';
    if (s.service) {
      const colors = { 'Ozon': 'status-ozon', 'Wildberries': 'status-wb', 'Яндекс.Маркет': 'status-yandex' };
      serviceBadge = `\n        \u003cspan class="card-status ${colors[s.service] || 'status-empty'}"\u003e${s.service}\u003c/span\u003e
      `;
    }
    
    card.innerHTML = `
      \u003cdiv class="card-header"\u003e
        \u003cspan class="card-title"\u003eКладовка #${s.id}\u003c/span\u003e
        \u003cspan class="card-price"\u003e${formatMoney(s.price)}\u003c/span\u003e
      \u003c/div\u003e
      \u003cdiv class="card-info"\u003e📍 ${s.address}\u003c/div\u003e
      \u003cdiv class="card-info"\u003e📐 ${s.area} м² | Аренда: ${formatMoney(s.rent)}/мес\u003c/div\u003e
      ${s.owner ? `\u003cdiv class="card-info"\u003e🔒 ${ownerText}\u003c/div\u003e${serviceBadge}` : '\u003cdiv class="card-info"\u003e✅ Свободно\u003c/div\u003e'}
    `;
    
    if (!s.owner) {
      card.onclick = () => buyStorage(s.id);
    }
    
    list.appendChild(card);
  });
}

function renderPlayers() {
  const list = document.getElementById('players-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  Object.values(gameState.players).forEach(p => {
    const isMe = p.id === gameState.playerId;
    const div = document.createElement('div');
    div.className = 'player-item' + (isMe ? ' me' : '') + (p.bankrupt ? ' bankrupt' : '');
    div.innerHTML = `
      \u003cstrong\u003e${p.name}${isMe ? ' (ты)' : ''}\u003c/strong\u003e
      \u003cbr\u003e💰 ${formatMoney(p.money)}
      \u003cbr\u003e🏭 ${p.storages.length} кладовок
      ${p.bankrupt ? '\u003cbr\u003e💀 Банкрот' : ''}
    `;
    list.appendChild(div);
  });
}

function renderChat() {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  
  list.innerHTML = '';
  
  gameState.messages.slice(-20).forEach(msg => {
    const div = document.createElement('div');
    div.className = 'chat-message';
    
    if (msg.type === 'chat') {
      div.innerHTML = `\u003cstrong\u003e${msg.playerName}:\u003c/strong\u003e ${msg.text}`;
    } else {
      div.className += ' system';
      div.textContent = msg.text;
    }
    
    list.appendChild(div);
  });
  
  list.scrollTop = list.scrollHeight;
}

function renderEvents(events) {
  const list = document.getElementById('events-list');
  const section = document.getElementById('events-section');
  
  section.classList.remove('hidden');
  list.innerHTML = '';
  
  events.forEach(e => {
    const div = document.createElement('div');
    div.className = 'event event-' + e.type;
    div.innerHTML = e.text + (e.desc ? `\u003cbr\u003e\u003csmall\u003e${e.desc}\u003c/small\u003e` : '');
    list.appendChild(div);
  });
}

function addSystemMessage(text) {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  
  const div = document.createElement('div');
  div.className = 'chat-message system';
  div.textContent = text;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function buyStorage(id) {
  socket.emit('buy-storage', { storageId: id });
}

function openPvzModal(storageId) {
  const modalBody = document.getElementById('modal-body');
  const player = gameState.players[gameState.playerId];
  const storage = player.storages.find(s => s.id === storageId);
  
  if (!storage || storage.service) return;
  
  modalBody.innerHTML = `
    \u003ch3\u003eОткрыть ПВЗ в кладовке #${storageId}\u003c/h3\u003e
    \u003cdiv style="margin: 20px 0;"\u003e
      \u003cdiv class="card" style="margin-bottom: 10px; cursor: pointer;" onclick="openPvz(${storageId}, 'ozon')"\u003e
        \u003cdiv class="card-header"\u003e
          \u003cspan class="card-title"\u003eOzon\u003c/span\u003e
          \u003cspan class="card-price"\u003e50 000 ₽\u003c/span\u003e
        \u003c/div\u003e
        \u003cdiv class="card-info"\u003e✅ Низкий риск, средняя маржа\u003c/div\u003e
      \u003c/div\u003e
      \u003cdiv class="card" style="margin-bottom: 10px; cursor: pointer;" onclick="openPvz(${storageId}, 'wb')"\u003e
        \u003cdiv class="card-header"\u003e
          \u003cspan class="card-title"\u003eWildberries\u003c/span\u003e
          \u003cspan class="card-price"\u003e80 000 ₽\u003c/span\u003e
        \u003c/div\u003e
        \u003cdiv class="card-info"\u003e🔥 Высокая маржа (+30%), но бабы любят WB\u003c/div\u003e
      \u003c/div\u003e
      \u003cdiv class="card" style="cursor: pointer;" onclick="openPvz(${storageId}, 'yandex')"\u003e
        \u003cdiv class="card-header"\u003e
          \u003cspan class="card-title"\u003eЯндекс.Маркет\u003c/span\u003e
          \u003cspan class="card-price"\u003e40 000 ₽\u003c/span\u003e
        \u003c/div\u003e
        \u003cdiv class="card-info"\u003e⚠️ Дешево, но -20% к доходу\u003c/div\u003e
      \u003c/div\u003e
    \u003c/div\u003e
  `;
  
  document.getElementById('modal').classList.remove('hidden');
}

function openPvz(storageId, service) {
  socket.emit('open-pvz', { storageId, service });
  closeModal();
}

function nextMonth() {
  socket.emit('next-month');
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (text) {
    socket.emit('chat-message', text);
    input.value = '';
  }
}

function showBankrupt() {
  const modalBody = document.getElementById('modal-body');
  const player = gameState.players[gameState.playerId];
  
  modalBody.innerHTML = `
    \u003cdiv class="game-over"\u003e
      \u003cdiv style="font-size: 4rem;"\u003e💀\u003c/div\u003e
      \u003ch2\u003eБАНКРОТСТВО!\u003c/h2\u003e
      \u003cp\u003eТы выдержал ${gameState.month} месяцев\u003c/p\u003e
      \u003cp\u003eВстречено баб-зомби: ${player.zombieCounter}\u003c/p\u003e
      \u003cbutton class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;"\u003e
        🔄 Перезайти
      \u003c/button\u003e
    \u003c/div\u003e
  `;
  
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Event listeners
document.getElementById('btn-market')?.addEventListener('click', () => {
  renderMarket();
  document.getElementById('market-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-players')?.addEventListener('click', () => {
  document.getElementById('players-section').classList.toggle('hidden');
});

document.getElementById('btn-chat')?.addEventListener('click', () => {
  document.getElementById('chat-section').classList.toggle('hidden');
});

document.getElementById('btn-next')?.addEventListener('click', nextMonth);

document.getElementById('chat-send')?.addEventListener('click', sendChat);
document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChat();
});

document.querySelector('.close')?.addEventListener('click', closeModal);

// Init
joinRoom();
