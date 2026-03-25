// Single-player version - works offline with localStorage
const ADDRESSES = [
  "ул. Ленина, 15 (подвал)", "пр. Карла Маркса, 42 (цоколь)",
  "ул. Куйбышева, 7 (1 этаж)", "ул. Антикайнена, 23 (помещение)",
  "пр. Первомайский, 88 (тех.этаж)", "ул. Федосова, 5 (цоколь)",
  "ул. Красная, 31 (подвал)", "пр. Лососинское, 156 (1 этаж)",
  "ул. Красноармейская, 12 (цоколь)", "ул. Пушкинская, 8 (подвал)",
];

const BABY_ZOMBIES = [
  { name: "Тётя Галя с 50 заказами", desc: "Пришла тётка с огромными пакетами, перебрала всё, забрала только чехол для телефона", rep: -8, cost: -15000 },
  { name: "Бабушка с 30 парами тапочек", desc: "Бабуля заказала 30 пар тапочек, померила все, забрала 2 самые дешёвые", rep: -5, cost: -8000 },
  { name: "Мамочка с детскими вещами", desc: "Мама заказала кучу детской одежды, ничего не подошло, ушла с нареканиями", rep: -10, cost: -12000 },
  { name: "Шопоголик со скидками", desc: "Девушка скупила всё по акциям, отказалась от 37 позиций", rep: -6, cost: -10000 }
];

const SERVICES = {
  ozon: { name: "Ozon", cost: 50000, m: 1.0 },
  wb: { name: "Wildberries", cost: 80000, m: 1.3 },
  yandex: { name: "Яндекс.Маркет", cost: 40000, m: 0.8 }
};

let game = {
  money: 500000,
  month: 1,
  cityPvz: 12,
  zombieCounter: 0,
  storages: [],
  market: [],
  events: []
};

function generateMarket() {
  const market = [];
  const used = [];
  for (let i = 0; i < 5; i++) {
    const available = ADDRESSES.filter(a => !used.includes(a));
    const addr = available[Math.floor(Math.random() * available.length)];
    used.push(addr);
    const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
    market.push({
      id: i + 1, address: addr, area,
      price: area * (80000 + Math.floor(Math.random() * 40000)),
      rent: area * (800 + Math.floor(Math.random() * 700)),
      hasPvz: false, service: null, income: 0, rep: 50
    });
  }
  return market;
}

function load() {
  const saved = localStorage.getItem('pvz_game');
  if (saved) {
    Object.assign(game, JSON.parse(saved));
  } else {
    game.market = generateMarket();
  }
}

function save() {
  localStorage.setItem('pvz_game', JSON.stringify(game));
}

function formatMoney(m) {
  return m.toLocaleString('ru-RU') + ' ₽';
}

function updateUI() {
  document.getElementById('month').textContent = game.month;
  document.getElementById('money').textContent = formatMoney(game.money);
  document.getElementById('city-pvz').textContent = game.cityPvz;
  document.getElementById('zombies').textContent = game.zombieCounter;
}

function renderMarket() {
  const list = document.getElementById('market-list');
  list.innerHTML = '';
  
  game.market.forEach(s => {
    if (s.hasPvz) return;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">Кладовка #${s.id}</span>
        <span class="card-price">${formatMoney(s.price)}</span>
      </div>
      <div class="card-info">📍 ${s.address}</div>
      <div class="card-info">📐 ${s.area} м² | Аренда: ${formatMoney(s.rent)}/мес</div>
    `;
    card.onclick = () => buyStorage(s.id);
    list.appendChild(card);
  });
}

function renderStorages() {
  const list = document.getElementById('storages-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (game.storages.length === 0) {
    list.innerHTML = '<p style="color: #888;">У тебя нет кладовок. Купи на рынке!</p>';
    return;
  }
  
  game.storages.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card';
    
    let statusHtml = '';
    if (s.service) {
      const colors = { 'Ozon': 'status-ozon', 'Wildberries': 'status-wb', 'Яндекс.Маркет': 'status-yandex' };
      statusHtml = `
        <span class="card-status ${colors[s.service] || 'status-empty'}">${s.service}</span>
        <div class="card-info">💰 Доход: ${formatMoney(s.income)}/мес</div>
        <div class="card-info">⭐ Репутация: ${s.rep}/100</div>
      `;
    } else {
      statusHtml = `
        <span class="card-status status-empty">ПУСТО</span>
        <div style="margin-top: 10px;">
          <button class="btn btn-primary" onclick="openPvzModal(${s.id})" ${s.area < 15 ? 'disabled' : ''}>
            Открыть ПВЗ ${s.area < 15 ? '(мало места)' : ''}
          </button>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">Кладовка #${s.id}</span>
      </div>
      <div class="card-info">📍 ${s.address}</div>
      <div class="card-info">📐 ${s.area} м² | Аренда: ${formatMoney(s.rent)}/мес</div>
      ${statusHtml}
    `;
    list.appendChild(card);
  });
}

function buyStorage(id) {
  const storage = game.market.find(s => s.id === id);
  if (!storage || storage.hasPvz || game.money < storage.price) {
    showModal('❌ Не удалось купить', 'Недостаточно денег или кладовка уже продана.');
    return;
  }
  
  game.money -= storage.price;
  storage.hasPvz = true;
  game.storages.push({...storage});
  
  // Add new storage
  const newId = Math.max(...game.market.map(s => s.id)) + 1;
  const used = game.market.map(s => s.address);
  const available = ADDRESSES.filter(a => !used.includes(a));
  const addr = available[Math.floor(Math.random() * available.length)];
  const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
  game.market.push({
    id: newId, address: addr, area,
    price: area * (80000 + Math.floor(Math.random() * 40000)),
    rent: area * (800 + Math.floor(Math.random() * 700)),
    hasPvz: false, service: null, income: 0, rep: 50
  });
  
  save();
  updateUI();
  renderMarket();
  if (document.getElementById('storages-section')) renderStorages();
  showModal('✅ Кладовка куплена!', `Теперь у тебя ${game.storages.length} кладовок.`);
}

function openPvzModal(storageId) {
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <h3>Выбери сервис для ПВЗ #${storageId}</h3>
    <div style="margin: 20px 0;">
      ${Object.entries(SERVICES).map(([key, svc]) => `
        <div class="card" style="margin-bottom: 10px; cursor: pointer;" onclick="openPvz(${storageId}, '${key}')">
          <div class="card-header">
            <span class="card-title">${svc.name}</span>
            <span class="card-price">${formatMoney(svc.cost)}</span>
          </div>
          <div class="card-info">
            ${svc.m > 1 ? '🔥 Высокая маржа (+30%)' : svc.m < 1 ? '⚠️ Рискованно (-20%)' : '✅ Средний риск'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function openPvz(storageId, serviceKey) {
  const storage = game.storages.find(s => s.id === storageId);
  const service = SERVICES[serviceKey];
  if (!storage || storage.service || game.money < service.cost) {
    showModal('❌ Ошибка', 'Недостаточно денег или кладовка занята.');
    return;
  }
  
  game.money -= service.cost;
  storage.service = service.name;
  storage.serviceKey = serviceKey;
  storage.income = Math.floor(storage.area * (2000 + Math.floor(Math.random() * 1500)) * service.m);
  
  save();
  closeModal();
  updateUI();
  renderStorages();
  showModal('✅ ПВЗ открыт!', `${service.name} работает! Ожидаемый доход: ${formatMoney(storage.income)}/мес`);
}

function nextMonth() {
  game.events = [];
  
  const newPvz = 1 + Math.floor(Math.random() * 3);
  game.cityPvz += newPvz;
  game.events.push({ type: 'info', text: `В городе открылось ${newPvz} новых ПВЗ! Всего: ${game.cityPvz}` });
  
  let totalIncome = 0, totalExpenses = 0;
  
  game.storages.forEach(s => {
    totalExpenses += s.rent;
    
    if (s.service) {
      let income = s.income;
      const competition = Math.max(0.3, 1 - (game.cityPvz * 0.02));
      income = Math.floor(income * competition);
      
      if (Math.random() < 0.20) {
        const baby = BABY_ZOMBIES[Math.floor(Math.random() * BABY_ZOMBIES.length)];
        game.zombieCounter++;
        game.events.push({
          type: 'baby', text: `🧟‍♀️ ${baby.name}!`,
          desc: baby.desc, cost: baby.cost
        });
        s.rep = Math.max(0, Math.min(100, s.rep + baby.rep));
        income += baby.cost;
      }
      
      income = Math.floor(income * (0.5 + (s.rep / 100)));
      totalIncome += Math.max(0, income);
    }
  });
  
  const profit = totalIncome - totalExpenses;
  game.money += profit;
  game.month++;
  
  game.events.push({
    type: profit >= 0 ? 'good' : 'bad',
    text: `Итоги: доход +${formatMoney(totalIncome)}, аренда -${formatMoney(totalExpenses)}, прибыль ${profit >= 0 ? '+' : ''}${formatMoney(profit)}`
  });
  
  save();
  
  if (game.money < 0) {
    showBankrupt();
  } else {
    const section = document.getElementById('events-section');
    const list = document.getElementById('events-list');
    if (section && list) {
      section.classList.remove('hidden');
      list.innerHTML = game.events.map(e => `
        <div class="event event-${e.type}">
          ${e.text}${e.desc ? `<br><small>${e.desc}</small>` : ''}
        </div>
      `).join('');
    }
    updateUI();
    renderStorages();
  }
}

function showBankrupt() {
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <div class="game-over">
      <div style="font-size: 4rem;">💀</div>
      <h2>БАНКРОТСТВО!</h2>
      <p>Ты выдержал ${game.month} месяцев</p>
      <p>Встречено баб-зомби: ${game.zombieCounter}</p>
      <button class="btn btn-primary" onclick="restartGame()" style="margin-top: 20px;">🔄 Новая игра</button>
    </div>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function restartGame() {
  game = {
    money: 500000, month: 1, cityPvz: 12, zombieCounter: 0,
    storages: [], market: generateMarket(), events: []
  };
  save();
  closeModal();
  updateUI();
  renderMarket();
  if (document.getElementById('storages-section')) renderStorages();
  const section = document.getElementById('events-section');
  if (section) section.classList.add('hidden');
}

function showModal(title, text) {
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `<h3>${title}</h3><p>${text}</p>`;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Init
load();
updateUI();
renderMarket();
renderStorages();

// Event listeners
document.getElementById('btn-market')?.addEventListener('click', () => {
  document.getElementById('market-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-storages')?.addEventListener('click', () => {
  renderStorages();
  document.getElementById('storages-section').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-next')?.addEventListener('click', nextMonth);
document.getElementById('btn-restart')?.addEventListener('click', restartGame);
document.querySelector('.close')?.addEventListener('click', closeModal);
document.getElementById('modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});
