const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(cors());

// Game state
const rooms = {};
const ADDRESSES = [
  "ул. Ленина, 15 (подвал)",
  "пр. Карла Маркса, 42 (цоколь)",
  "ул. Куйбышева, 7 (1 этаж)",
  "ул. Антикайнена, 23 (помещение)",
  "пр. Первомайский, 88 (тех.этаж)",
  "ул. Федосова, 5 (цоколь)",
  "ул. Красная, 31 (подвал)",
  "пр. Лососинское, 156 (1 этаж)",
];

const BABY_ZOMBIES = [
  {
    name: "Тётя Галя с 50 заказами",
    orders: 50,
    taken: 1,
    desc: "Пришла тётка с огромными пакетами, перебрала всё, забрала только чехол для телефона",
    rep: -8,
    cost: -15000
  },
  {
    name: "Бабушка с 30 парами тапочек", 
    orders: 30,
    taken: 2,
    desc: "Бабуля заказала 30 пар тапочек, померила все, забрала 2 самые дешёвые",
    rep: -5,
    cost: -8000
  },
  {
    name: "Мамочка с детскими вещами",
    orders: 25,
    taken: 0,
    desc: "Мама заказала кучу детской одежды, ничего не подошло, ушла с нареканиями",
    rep: -10,
    cost: -12000
  },
  {
    name: "Шопоголик со скидками",
    orders: 40,
    taken: 3,
    desc: "Девушка скупила всё по акциям, отказалась от 37 позиций",
    rep: -6,
    cost: -10000
  }
];

function generateMarket() {
  const market = [];
  const used = [];
  for (let i = 0; i < 8; i++) {
    const available = ADDRESSES.filter(a => !used.includes(a));
    const addr = available[Math.floor(Math.random() * available.length)];
    used.push(addr);
    const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
    const price = area * (80000 + Math.floor(Math.random() * 40000));
    const rent = area * (800 + Math.floor(Math.random() * 700));
    market.push({
      id: i + 1,
      address: addr,
      area: area,
      price: price,
      rent: rent,
      owner: null,
      service: null,
      income: 0,
      rep: 50
    });
  }
  return market;
}

function createRoom(roomId) {
  return {
    id: roomId,
    players: {},
    market: generateMarket(),
    cityPvz: 12,
    month: 1,
    messages: [],
    started: false
  };
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Join room
  socket.on('join-room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
    }
    
    const room = rooms[roomId];
    
    // Add player
    room.players[socket.id] = {
      id: socket.id,
      name: playerName,
      money: 500000,
      storages: [],
      zombieCounter: 0,
      ready: false,
      bankrupt: false
    };
    
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerName = playerName;
    
    // Send current state
    socket.emit('room-joined', {
      roomId,
      playerId: socket.id,
      market: room.market,
      cityPvz: room.cityPvz,
      month: room.month,
      players: room.players,
      messages: room.messages
    });
    
    // Notify others
    socket.to(roomId).emit('player-joined', {
      player: room.players[socket.id]
    });
    
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Buy storage
  socket.on('buy-storage', ({ storageId }) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    
    const player = room.players[socket.id];
    const storage = room.market.find(s => s.id === storageId);
    
    if (!storage || storage.owner || player.money < storage.price) {
      socket.emit('buy-failed', { reason: 'Недостаточно денег или кладовка занята' });
      return;
    }
    
    player.money -= storage.price;
    storage.owner = socket.id;
    player.storages.push({ ...storage });
    
    // Notify everyone
    io.to(socket.roomId).emit('storage-bought', {
      playerId: socket.id,
      playerName: player.name,
      storageId,
      price: storage.price,
      market: room.market,
      players: room.players
    });
    
    // Add message
    const msg = {
      id: Date.now(),
      type: 'buy',
      text: `${player.name} купил кладовку #${storageId}`,
      time: new Date().toLocaleTimeString()
    };
    room.messages.push(msg);
    io.to(socket.roomId).emit('new-message', msg);
  });

  // Open PVZ
  socket.on('open-pvz', ({ storageId, service }) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    
    const player = room.players[socket.id];
    const storage = player.storages.find(s => s.id === storageId);
    
    if (!storage || storage.service) return;
    
    const services = {
      ozon: { name: "Ozon", cost: 50000, multiplier: 1.0 },
      wb: { name: "Wildberries", cost: 80000, multiplier: 1.3 },
      yandex: { name: "Яндекс.Маркет", cost: 40000, multiplier: 0.8 }
    };
    
    const svc = services[service];
    if (!svc || player.money < svc.cost) return;
    
    player.money -= svc.cost;
    storage.service = svc.name;
    storage.serviceKey = service;
    const baseIncome = storage.area * (2000 + Math.floor(Math.random() * 1500));
    storage.income = Math.floor(baseIncome * svc.multiplier);
    
    // Update market storage too
    const marketStorage = room.market.find(s => s.id === storageId);
    if (marketStorage) {
      marketStorage.service = svc.name;
    }
    
    io.to(socket.roomId).emit('pvz-opened', {
      playerId: socket.id,
      playerName: player.name,
      storageId,
      service: svc.name,
      players: room.players,
      market: room.market
    });
    
    const msg = {
      id: Date.now(),
      type: 'open',
      text: `${player.name} открыл ${svc.name} в кладовке #${storageId}`,
      time: new Date().toLocaleTimeString()
    };
    room.messages.push(msg);
    io.to(socket.roomId).emit('new-message', msg);
  });

  // Next month
  socket.on('next-month', () => {
    const room = rooms[socket.roomId];
    if (!room) return;
    
    const player = room.players[socket.id];
    
    // City grows
    const newPvz = 1 + Math.floor(Math.random() * 3);
    room.cityPvz += newPvz;
    
    let totalIncome = 0;
    let totalExpenses = 0;
    const events = [];
    
    events.push({
      type: 'info',
      text: `В городе открылось ${newPvz} новых ПВЗ! Всего: ${room.cityPvz}`
    });
    
    player.storages.forEach(s => {
      totalExpenses += s.rent;
      
      if (s.service) {
        let income = s.income;
        const competition = Math.max(0.3, 1 - (room.cityPvz * 0.02));
        income = Math.floor(income * competition);
        
        // Baby zombie attack
        if (Math.random() < 0.20) {
          const baby = BABY_ZOMBIES[Math.floor(Math.random() * BABY_ZOMBIES.length)];
          player.zombieCounter++;
          events.push({
            type: 'baby',
            text: `🧟‍♀️ ${baby.name}!`,
            desc: baby.desc,
            cost: baby.cost,
            rep: baby.rep
          });
          s.rep = Math.max(0, Math.min(100, s.rep + baby.rep));
          income += baby.cost;
        }
        
        const repMult = 0.5 + (s.rep / 100);
        income = Math.floor(income * repMult);
        totalIncome += Math.max(0, income);
      }
    });
    
    const profit = totalIncome - totalExpenses;
    player.money += profit;
    
    events.push({
      type: profit >= 0 ? 'good' : 'bad',
      text: `Итоги: доход +${totalIncome.toLocaleString()}₽, аренда -${totalExpenses.toLocaleString()}₽, прибыль ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}₽`
    });
    
    if (player.money < 0) {
      player.bankrupt = true;
      events.push({
        type: 'bankrupt',
        text: `💀 ${player.name} обанкротился!`
      });
    }
    
    room.month++;
    
    socket.emit('month-result', {
      events,
      player,
      cityPvz: room.cityPvz,
      month: room.month
    });
    
    // Notify others about this player's turn
    socket.to(socket.roomId).emit('player-turn', {
      playerId: socket.id,
      playerName: player.name,
      month: room.month
    });
  });

  // Chat message
  socket.on('chat-message', (text) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    
    const player = room.players[socket.id];
    const msg = {
      id: Date.now(),
      type: 'chat',
      playerName: player.name,
      text,
      time: new Date().toLocaleTimeString()
    };
    
    room.messages.push(msg);
    io.to(socket.roomId).emit('new-message', msg);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const room = rooms[socket.roomId];
    if (room && room.players[socket.id]) {
      const playerName = room.players[socket.id].name;
      delete room.players[socket.id];
      
      socket.to(socket.roomId).emit('player-left', {
        playerId: socket.id,
        playerName
      });
      
      // Clean up empty rooms
      if (Object.keys(room.players).length === 0) {
        delete rooms[socket.roomId];
        console.log(`Room ${socket.roomId} deleted`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
