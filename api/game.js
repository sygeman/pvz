// Server-Sent Events Multiplayer for Vercel
// Stateless: state хранится в памяти (сбросится при редеплое)

const rooms = {};

const ADDRESSES = [
  "ул. Ленина, 15 (подвал)", "пр. Карла Маркса, 42 (цоколь)",
  "ул. Куйбышева, 7 (1 этаж)", "ул. Антикайнена, 23 (помещение)",
  "пр. Первомайский, 88 (тех.этаж)", "ул. Федосова, 5 (цоколь)",
  "ул. Красная, 31 (подвал)", "пр. Лососинское, 156 (1 этаж)",
];

const BABY_ZOMBIES = [
  { name: "Тётя Галя", desc: "50 заказов, забрала 1 чехол", rep: -8, cost: -15000 },
  { name: "Бабушка", desc: "30 пар тапочек, взяла 2 дешёвые", rep: -5, cost: -8000 },
  { name: "Мамочка", desc: "25 позиций, ничего не взяла", rep: -10, cost: -12000 },
  { name: "Шопоголик", desc: "40 позиций по акциям, отказалась от 37", rep: -6, cost: -10000 }
];

function generateMarket() {
  const market = [];
  const used = [];
  for (let i = 0; i < 8; i++) {
    const available = ADDRESSES.filter(a => !used.includes(a));
    const addr = available[Math.floor(Math.random() * available.length)];
    used.push(addr);
    const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
    market.push({
      id: i + 1, address: addr, area,
      price: area * (80000 + Math.floor(Math.random() * 40000)),
      rent: area * (800 + Math.floor(Math.random() * 700)),
      owner: null, service: null, income: 0, rep: 50
    });
  }
  return market;
}

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      id: roomId,
      players: {},
      market: generateMarket(),
      cityPvz: 12, month: 1,
      messages: [], clients: []
    };
  }
  return rooms[roomId];
}

function broadcast(room, data) {
  const deadClients = [];
  room.clients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      deadClients.push(client);
    }
  });
  room.clients = room.clients.filter(c => !deadClients.includes(c));
}

function addMessage(room, type, text) {
  const msg = { id: Date.now(), type, text, time: new Date().toLocaleTimeString() };
  room.messages.push(msg);
  if (room.messages.length > 50) room.messages.shift();
  return msg;
}

export default function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  
  // SSE endpoint
  if (url.pathname === '/api/events') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const room = getOrCreateRoom(roomId);
    room.clients.push(res);
    
    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'init', roomId, cityPvz: room.cityPvz, month: room.month, market: room.market, players: room.players, messages: room.messages })}\n\n`);
    
    req.on('close', () => {
      room.clients = room.clients.filter(c => c !== res);
    });
    
    return;
  }
  
  // Join
  if (url.pathname === '/api/join') {
    const room = getOrCreateRoom(roomId);
    const playerId = url.searchParams.get('playerId') || Math.random().toString(36).substr(2, 9);
    const playerName = url.searchParams.get('name') || 'Игрок' + Math.floor(Math.random() * 1000);
    
    room.players[playerId] = {
      id: playerId, name: playerName,
      money: 500000, storages: [], zombieCounter: 0, lastSeen: Date.now()
    };
    
    const msg = addMessage(room, 'join', `${playerName} присоединился`);
    broadcast(room, { type: 'player-joined', player: room.players[playerId], players: room.players, message: msg });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ playerId, player: room.players[playerId] });
    return;
  }
  
  // Buy storage
  if (url.pathname === '/api/buy') {
    const room = getOrCreateRoom(roomId);
    const playerId = url.searchParams.get('playerId');
    const storageId = parseInt(url.searchParams.get('storageId'));
    
    const player = room.players[playerId];
    const storage = room.market.find(s => s.id === storageId);
    
    if (!player || !storage || storage.owner || player.money < storage.price) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'Нельзя купить' });
      return;
    }
    
    player.money -= storage.price;
    storage.owner = playerId;
    player.storages.push({ ...storage });
    
    const msg = addMessage(room, 'buy', `${player.name} купил кладовку #${storageId}`);
    broadcast(room, { type: 'storage-bought', playerId, storageId, player, market: room.market, players: room.players, message: msg });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ success: true, player, market: room.market });
    return;
  }
  
  // Open PVZ
  if (url.pathname === '/api/open') {
    const room = getOrCreateRoom(roomId);
    const playerId = url.searchParams.get('playerId');
    const storageId = parseInt(url.searchParams.get('storageId'));
    const service = url.searchParams.get('service');
    
    const player = room.players[playerId];
    const storage = player?.storages.find(s => s.id === storageId);
    
    if (!player || !storage || storage.service) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'Нельзя открыть' });
      return;
    }
    
    const services = { ozon: { name: "Ozon", cost: 50000, m: 1.0 }, wb: { name: "Wildberries", cost: 80000, m: 1.3 }, yandex: { name: "Яндекс.Маркет", cost: 40000, m: 0.8 } };
    const svc = services[service];
    if (!svc || player.money < svc.cost) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'Недостаточно денег' });
      return;
    }
    
    player.money -= svc.cost;
    storage.service = svc.name;
    storage.serviceKey = service;
    storage.income = Math.floor(storage.area * (2000 + Math.floor(Math.random() * 1500)) * svc.m);
    
    const marketStorage = room.market.find(s => s.id === storageId);
    if (marketStorage) marketStorage.service = svc.name;
    
    const msg = addMessage(room, 'open', `${player.name} открыл ${svc.name}`);
    broadcast(room, { type: 'pvz-opened', playerId, storageId, service: svc.name, players: room.players, message: msg });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ success: true, player });
    return;
  }
  
  // Next month
  if (url.pathname === '/api/next') {
    const room = getOrCreateRoom(roomId);
    const playerId = url.searchParams.get('playerId');
    const player = room.players[playerId];
    
    if (!player) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({ error: 'No player' });
      return;
    }
    
    const newPvz = 1 + Math.floor(Math.random() * 3);
    room.cityPvz += newPvz;
    room.month++;
    
    let totalIncome = 0, totalExpenses = 0;
    const events = [{ type: 'info', text: `В городе открылось ${newPvz} новых ПВЗ! Всего: ${room.cityPvz}` }];
    
    player.storages.forEach(s => {
      totalExpenses += s.rent;
      if (s.service) {
        let income = s.income;
        const competition = Math.max(0.3, 1 - (room.cityPvz * 0.02));
        income = Math.floor(income * competition);
        
        if (Math.random() < 0.20) {
          const baby = BABY_ZOMBIES[Math.floor(Math.random() * BABY_ZOMBIES.length)];
          player.zombieCounter++;
          events.push({ type: 'baby', text: `🧟‍♀️ ${baby.name}!`, desc: baby.desc, cost: baby.cost });
          s.rep = Math.max(0, Math.min(100, s.rep + baby.rep));
          income += baby.cost;
        }
        
        income = Math.floor(income * (0.5 + (s.rep / 100)));
        totalIncome += Math.max(0, income);
      }
    });
    
    const profit = totalIncome - totalExpenses;
    player.money += profit;
    
    events.push({ type: profit >= 0 ? 'good' : 'bad', text: `Прибыль: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}₽` });
    
    if (player.money < 0) {
      player.bankrupt = true;
      events.push({ type: 'bankrupt', text: `💀 ${player.name} обанкротился!` });
    }
    
    broadcast(room, { type: 'month-result', playerId, player, month: room.month, cityPvz: room.cityPvz, events });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ success: true, player, events, month: room.month });
    return;
  }
  
  // Chat
  if (url.pathname === '/api/chat') {
    const room = getOrCreateRoom(roomId);
    const playerId = url.searchParams.get('playerId');
    const text = url.searchParams.get('text');
    const player = room.players[playerId];
    
    if (player && text) {
      const msg = addMessage(room, 'chat', text);
      msg.playerName = player.name;
      broadcast(room, { type: 'chat', message: msg });
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ success: true });
    return;
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(404).json({ error: 'Not found' });
}
