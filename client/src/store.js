import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const ADDRESSES = [
  "ул. Ленина, 15 (подвал)", "пр. Карла Маркса, 42 (цоколь)",
  "ул. Куйбышева, 7 (1 этаж)", "ул. Антикайнена, 23 (помещение)",
  "пр. Первомайский, 88 (тех.этаж)", "ул. Федосова, 5 (цоколь)",
  "ул. Красная, 31 (подвал)", "пр. Лососинское, 156 (1 этаж)",
];

const BABY_ZOMBIES = [
  { name: "Тётя Галя с 50 заказами", desc: "Пришла тётка с огромными пакетами, перебрала всё, забрала только чехол для телефона", rep: -8, cost: -15000 },
  { name: "Бабушка с 30 парами тапочек", desc: "Бабуля заказала 30 пар тапочек, померила все, забрала 2 самые дешёвые", rep: -5, cost: -8000 },
  { name: "Мамочка с детскими вещами", desc: "Мама заказала кучу детской одежды, ничего не подошло, ушла с нареканиями", rep: -10, cost: -12000 },
  { name: "Шопоголик со скидками", desc: "Девушка скупила всё по акциям, отказалась от 37 позиций", rep: -6, cost: -10000 }
];

const SERVICES = {
  ozon: { name: "Ozon", cost: 50000, m: 1.0, color: "#005bff" },
  wb: { name: "Wildberries", cost: 80000, m: 1.3, color: "#8b00ff" },
  yandex: { name: "Яндекс.Маркет", cost: 40000, m: 0.8, color: "#fc0" }
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

export const useGameStore = defineStore('game', () => {
  // State
  const user = ref(null);
  const sessionId = ref(localStorage.getItem('sessionId'));
  const money = ref(500000);
  const month = ref(1);
  const cityPvz = ref(12);
  const zombieCounter = ref(0);
  const storages = ref([]);
  const market = ref(generateMarket());
  const events = ref([]);
  const selectedStorage = ref(null);
  const showPvzModal = ref(false);

  // Getters
  const formatMoney = (m) => m?.toLocaleString('ru-RU') + ' ₽';
  
  const availableStorages = computed(() => 
    market.value.filter(s => !s.hasPvz)
  );
  
  const myStorages = computed(() => storages.value);

  // Actions
  async function fetchUser() {
    if (!sessionId.value) return;
    try {
      const res = await fetch('/api/me', {
        headers: { 'X-Session-Id': sessionId.value }
      });
      if (res.ok) {
        user.value = await res.json();
        await loadGame();
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  }

  function setSession(id) {
    sessionId.value = id;
    localStorage.setItem('sessionId', id);
  }

  function logout() {
    sessionId.value = null;
    user.value = null;
    localStorage.removeItem('sessionId');
    resetGame();
  }

  function resetGame() {
    money.value = 500000;
    month.value = 1;
    cityPvz.value = 12;
    zombieCounter.value = 0;
    storages.value = [];
    market.value = generateMarket();
    events.value = [];
  }

  function buyStorage(storageId) {
    const storage = market.value.find(s => s.id === storageId);
    if (!storage || storage.hasPvz || money.value < storage.price) {
      return false;
    }
    
    money.value -= storage.price;
    storage.hasPvz = true;
    storages.value.push({ ...storage });
    
    // Add new storage
    const newId = Math.max(...market.value.map(s => s.id)) + 1;
    const used = market.value.map(s => s.address);
    const available = ADDRESSES.filter(a => !used.includes(a));
    const addr = available[Math.floor(Math.random() * available.length)];
    const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
    market.value.push({
      id: newId, address: addr, area,
      price: area * (80000 + Math.floor(Math.random() * 40000)),
      rent: area * (800 + Math.floor(Math.random() * 700)),
      hasPvz: false, service: null, income: 0, rep: 50
    });
    
    saveGame();
    return true;
  }

  function openPvz(storageId, serviceKey) {
    const storage = storages.value.find(s => s.id === storageId);
    const service = SERVICES[serviceKey];
    
    if (!storage || storage.service || money.value < service.cost) {
      return false;
    }
    
    money.value -= service.cost;
    storage.service = service.name;
    storage.serviceKey = serviceKey;
    storage.income = Math.floor(storage.area * (2000 + Math.floor(Math.random() * 1500)) * service.m);
    
    saveGame();
    return true;
  }

  function nextMonth() {
    events.value = [];
    
    const newPvz = 1 + Math.floor(Math.random() * 3);
    cityPvz.value += newPvz;
    events.value.push({
      type: 'info', text: `В городе открылось ${newPvz} новых ПВЗ! Всего: ${cityPvz.value}`
    });
    
    let totalIncome = 0, totalExpenses = 0;
    
    storages.value.forEach(s => {
      totalExpenses += s.rent;
      
      if (s.service) {
        let income = s.income;
        const competition = Math.max(0.3, 1 - (cityPvz.value * 0.02));
        income = Math.floor(income * competition);
        
        if (Math.random() < 0.20) {
          const baby = BABY_ZOMBIES[Math.floor(Math.random() * BABY_ZOMBIES.length)];
          zombieCounter.value++;
          events.value.push({
            type: 'baby', text: `🧟‍♀️ ${baby.name}!`, desc: baby.desc
          });
          s.rep = Math.max(0, Math.min(100, s.rep + baby.rep));
          income += baby.cost;
        }
        
        income = Math.floor(income * (0.5 + (s.rep / 100)));
        totalIncome += Math.max(0, income);
      }
    });
    
    const profit = totalIncome - totalExpenses;
    money.value += profit;
    month.value++;
    
    events.value.push({
      type: profit >= 0 ? 'good' : 'bad',
      text: `Итоги: доход +${formatMoney(totalIncome)}, аренда -${formatMoney(totalExpenses)}, прибыль ${profit >= 0 ? '+' : ''}${formatMoney(profit)}`
    });
    
    saveGame();
    return money.value >= 0;
  }

  async function saveGame() {
    if (!sessionId.value) return;
    try {
      await fetch('/api/game/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId.value
        },
        body: JSON.stringify({
          money: money.value,
          month: month.value,
          cityPvz: cityPvz.value,
          zombieCounter: zombieCounter.value,
          storages: storages.value,
          market: market.value
        })
      });
    } catch (e) {
      console.error('Failed to save:', e);
    }
  }

  async function loadGame() {
    if (!sessionId.value) return;
    try {
      const res = await fetch('/api/game/load', {
        headers: { 'X-Session-Id': sessionId.value }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          money.value = data.money;
          month.value = data.month;
          cityPvz.value = data.cityPvz;
          zombieCounter.value = data.zombieCounter;
          storages.value = data.storages || [];
          market.value = data.market || generateMarket();
        }
      }
    } catch (e) {
      console.error('Failed to load:', e);
    }
  }

  return {
    user, sessionId, money, month, cityPvz, zombieCounter,
    storages, market, events, selectedStorage, showPvzModal,
    formatMoney, availableStorages, myStorages,
    fetchUser, setSession, logout, resetGame,
    buyStorage, openPvz, nextMonth, saveGame, loadGame
  };
});
