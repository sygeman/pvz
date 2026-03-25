// SSE Multiplayer Client for Vercel
let gameState = {
  roomId: 'default',
  playerId: null,
  playerName: null,
  market: [],
  players: {},
  cityPvz: 12,
  month: 1,
  messages: [],
  connected: false
};

let eventSource = null;
const API_BASE = '/api';

function init() {
  const urlParams = new URLSearchParams(window.location.search);
  gameState.roomId = urlParams.get('room') || 'default';
  gameState.playerName = urlParams.get('name') || 'Игрок' + Math.floor(Math.random() * 1000);
  
  document.getElementById('room-info').textContent = `Комната: ${gameState.roomId}`;
  document.getElementById('player-name').textContent = gameState.playerName;
  
  connectSSE();
}

function connectSSE() {
  const url = `${API_BASE}/events?room=${gameState.roomId}`;
  eventSource = new EventSource(url);
  
  eventSource.onopen = () => {
    console.log('SSE connected');
    joinGame();
  };
  
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    handleEvent(data);
  };
  
  eventSource.onerror = (e) => {
    console.error('SSE error:', e);
    setTimeout(connectSSE, 3000);
  };
}

function handleEvent(data) {
  switch(data.type) {
    case 'init':
      gameState.market = data.market;
      gameState.players = data.players;
      gameState.cityPvz = data.cityPvz;
      gameState.month = data.month;
      gameState.messages = data.messages;
      updateUI();
      renderMarket();
      renderPlayers();
      renderChat();
      break;
      
    case 'player-joined':
      gameState.players = data.players;
      gameState.messages.push(data.message);
      renderPlayers();
      renderChat();
      break;
      
    case 'storage-bought':
      gameState.market = data.market;
      gameState.players = data.players;
      gameState.messages.push(data.message);
      renderMarket();
      renderPlayers();
      renderChat();
      break;
      
    case 'pvz-opened':
      gameState.players = data.players;
      gameState.messages.push(data.message);
      renderMarket();
      renderPlayers();
      renderChat();
      break;
      
    case 'month-result':
      if (data.playerId === gameState.playerId) {
        gameState.players[gameState.playerId] = data.player;
        gameState.month = data.month;
        gameState.cityPvz = data.cityPvz;
        renderEvents(data.events);
        updateUI();
        renderPlayers();
        
        if (data.player.bankrupt) {
          showBankrupt();
        }
      } else {
        gameState.players[data.playerId] = data.player;
        renderPlayers();
      }
      break;
      
    case 'chat':
      gameState.messages.push(data.message);
      renderChat();
      break;
  }
}

async function joinGame() {
  const res = await fetch(`${API_BASE}/join?room=${gameState.roomId}&name=${encodeURIComponent(gameState.playerName)}`);
  const data = await res.json();
  gameState.playerId = data.playerId;
  gameState.players[data.playerId] = data.player;
  updateUI();
  renderPlayers();
}

async function buyStorage(id) {
  const res = await fetch(`${API_BASE}/buy?room=${gameState.roomId}&playerId=${gameState.playerId}&storageId=${id}`);
  const data = await res.json();
  if (data.error) {
    alert(data.error);
  }
}

async function openPvz(storageId, service) {
  const res = await fetch(`${API_BASE}/open?room=${gameState.roomId}&playerId=${gameState.playerId}&storageId=${storageId}&service=${service}`);
  const data = await res.json();
  if (data.error) {
    alert(data.error);
  } else {
    closeModal();
  }
}

async function nextMonth() {
  const res = await fetch(`${API_BASE}/next?room=${gameState.roomId}&playerId=${gameState.playerId}`);
  const data = await res.json();
  if (data.error) {
    alert(data.error);
  }
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  
  await fetch(`${API_BASE}/chat?room=${gameState.roomId}&playerId=${gameState.playerId}&text=${encodeURIComponent(text)}`);
  input.value = '';
}

// UI functions
function updateUI() {
  const player = gameState.players[gameState.playerId];
  if (!player) return;
  
  document.getElementById('month').textContent = gameState.month;
  document.getElementById('money').textContent = formatMoney(player.money);
  document.getElementById('city-pvz').textContent = gameState.cityPvz;
  document.getElementById('zombies').textContent = player.zombieCounter;
}

function formatMoney(m) {
  return m?.toLocaleString('ru-RU') + ' ₽' || '0 ₽';
}

function renderMarket() {
  const list = document.getElementById('market-list');
  list.innerHTML = '';
  
  gameState.market.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card' + (s.owner ? ' disabled' : '');
    
    const owner = s.owner ? gameState.players[s.owner] : null;
    const isMine = s.owner === gameState.playerId;
    
    let statusHtml = '';
    if (s.service) {
      const colors = { 'Ozon': 'status-ozon', 'Wildberries': 'status-wb', 'Яндекс.Маркет': 'status-yandex' };
      statusHtml = `\u003cspan class="card-status ${colors[s.service]}"\u003e${s.service}\u003c/span\u003e`;
    } else if (isMine) {
      statusHtml = `\u003cbutton class="btn btn-primary btn-small" onclick="openPvzModal(${s.id})"\u003eОткрыть ПВЗ\u003c/button\u003e`;
    }
    
    card.innerHTML = `
      \u003cdiv class="card-header"\u003e
        \u003cspan class="card-title"\u003eКладовка #${s.id}\u003c/span\u003e
        \u003cspan class="card-price"\u003e${formatMoney(s.price)}\u003c/span\u003e
      \u003c/div\u003e
      \u003cdiv class="card-info"\u003e📍 ${s.address}\u003c/div\u003e
      \u003cdiv class="card-info"\u003e📐 ${s.area} м² | Аренда: ${formatMoney(s.rent)}/мес\u003c/div\u003e
      ${owner ? `\u003cdiv class="card-info"\u003e🔒 ${owner.name}${isMine ? ' (ты)' : ''}\u003c/div\u003e${statusHtml}` : '\u003cdiv class="card-info"\u003e✅ Свободно\u003c/div\u003e'}
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
      \u003cbr\u003e🏭 ${p.storages?.length || 0} кладовок
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
    div.className = 'chat-message' + (msg.type !== 'chat' ? ' system' : '');
    
    if (msg.type === 'chat' && msg.playerName) {
      div.innerHTML = `\u003cstrong\u003e${msg.playerName}:\u003c/strong\u003e ${msg.text}`;
    } else {
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

function openPvzModal(storageId) {
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    \u003ch3\u003eОткрыть ПВЗ в кладовке #${storageId}\u003c/h3\u003e
    \u003cdiv style="margin: 20px 0;"\u003e
      \u003cdiv class="card" style="margin-bottom: 10px; cursor: pointer;" onclick="openPvz(${storageId}, 'ozon')"\u003e
        \u003cdiv class="card-header"\u003e\u003cspan class="card-title"\u003eOzon\u003c/span\u003e\u003cspan class="card-price"\u003e50 000 ₽\u003c/span\u003e\u003c/div\u003e
        \u003cdiv class="card-info"\u003e✅ Низкий риск, средняя маржа\u003c/div\u003e
      \u003c/div\u003e
      \u003cdiv class="card" style="margin-bottom: 10px; cursor: pointer;" onclick="openPvz(${storageId}, 'wb')"\u003e
        \u003cdiv class="card-header"\u003e\u003cspan class="card-title"\u003eWildberries\u003c/span\u003e\u003cspan class="card-price"\u003e80 000 ₽\u003c/span\u003e\u003c/div\u003e
        \u003cdiv class="card-info"\u003e🔥 Высокая маржа (+30%), но бабы любят WB\u003c/div\u003e
      \u003c/div\u003e
      \u003cdiv class="card" style="cursor: pointer;" onclick="openPvz(${storageId}, 'yandex')"\u003e
        \u003cdiv class="card-header"\u003e\u003cspan class="card-title"\u003eЯндекс.Маркет\u003c/span\u003e\u003cspan class="card-price"\u003e40 000 ₽\u003c/span\u003e\u003c/div\u003e
        \u003cdiv class="card-info"\u003e⚠️ Дешево, но -20% к доходу\u003c/div\u003e
      \u003c/div\u003e
    \u003c/div\u003e
  `;
  document.getElementById('modal').classList.remove('hidden');
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
      \u003cbutton class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;"\u003e🔄 Перезайти\u003c/button\u003e
    \u003c/div\u003e
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Event listeners
document.getElementById('btn-market')?.addEventListener('click', () => {
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
init();
