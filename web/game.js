const ADDRESSES = [
    "ул. Ленина, 15 (подвал)",
    "пр. Карла Маркса, 42 (цоколь)",
    "ул. Куйбышева, 7 (1 этаж)",
    "ул. Антикайнена, 23 (помещение)",
    "пр. Первомайский, 88 (тех.этаж)",
    "ул. Федосова, 5 (цоколь)",
    "ул. Красная, 31 (подвал)",
    "пр. Лососинское, 156 (1 этаж)",
    "ул. Красноармейская, 12 (цоколь)",
    "ул. Пушкинская, 8 (подвал)",
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

const SERVICES = {
    ozon: { name: "Ozon", cost: 50000, multiplier: 1.0, color: "status-ozon" },
    wb: { name: "Wildberries", cost: 80000, multiplier: 1.3, color: "status-wb" },
    yandex: { name: "Яндекс.Маркет", cost: 40000, multiplier: 0.8, color: "status-yandex" }
};

class Game {
    constructor() {
        this.reset();
        this.load();
    }

    reset() {
        this.money = 500000;
        this.month = 1;
        this.cityPvz = 12;
        this.zombieCounter = 0;
        this.storages = [];
        this.market = this.generateMarket();
        this.events = [];
    }

    load() {
        const saved = localStorage.getItem('pvz_game');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(this, data);
        }
    }

    save() {
        localStorage.setItem('pvz_game', JSON.stringify({
            money: this.money,
            month: this.month,
            cityPvz: this.cityPvz,
            zombieCounter: this.zombieCounter,
            storages: this.storages,
            market: this.market
        }));
    }

    generateMarket() {
        const market = [];
        const used = [];
        for (let i = 0; i < 5; i++) {
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
                hasPvz: false,
                service: null,
                income: 0,
                rep: 50
            });
        }
        return market;
    }

    formatMoney(m) {
        return m.toLocaleString('ru-RU') + ' ₽';
    }

    buyStorage(id) {
        const storage = this.market.find(s => s.id === id);
        if (!storage || storage.hasPvz) return false;
        if (this.money < storage.price) return false;

        this.money -= storage.price;
        storage.hasPvz = true;
        this.storages.push({...storage});

        // Add new storage to market
        const newId = Math.max(...this.market.map(s => s.id)) + 1;
        const used = this.market.map(s => s.address);
        const available = ADDRESSES.filter(a => !used.includes(a));
        const addr = available[Math.floor(Math.random() * available.length)];
        const area = [12, 15, 18, 20, 25, 30][Math.floor(Math.random() * 6)];
        this.market.push({
            id: newId,
            address: addr,
            area: area,
            price: area * (80000 + Math.floor(Math.random() * 40000)),
            rent: area * (800 + Math.floor(Math.random() * 700)),
            hasPvz: false,
            service: null,
            income: 0,
            rep: 50
        });

        this.save();
        return true;
    }

    openPvz(storageId, serviceKey) {
        const storage = this.storages.find(s => s.id === storageId);
        if (!storage || storage.service) return false;
        if (storage.area < 15) return false;

        const service = SERVICES[serviceKey];
        if (!service) return false;
        if (this.money < service.cost) return false;

        this.money -= service.cost;
        storage.service = service.name;
        storage.serviceKey = serviceKey;
        const baseIncome = storage.area * (2000 + Math.floor(Math.random() * 1500));
        storage.income = Math.floor(baseIncome * service.multiplier);

        this.save();
        return true;
    }

    nextMonth() {
        this.events = [];
        
        // New PVZ in city
        const newPvz = 1 + Math.floor(Math.random() * 3);
        this.cityPvz += newPvz;
        this.events.push({
            type: 'info',
            text: `В городе открылось ${newPvz} новых ПВЗ! Всего: ${this.cityPvz}`
        });

        let totalIncome = 0;
        let totalExpenses = 0;

        this.storages.forEach(s => {
            totalExpenses += s.rent;

            if (s.service) {
                let income = s.income;
                
                // Competition reduces income
                const competition = Math.max(0.3, 1 - (this.cityPvz * 0.02));
                income = Math.floor(income * competition);

                // Baby zombie attack
                if (Math.random() < 0.20) {
                    const baby = BABY_ZOMBIES[Math.floor(Math.random() * BABY_ZOMBIES.length)];
                    this.zombieCounter++;
                    this.events.push({
                        type: 'baby',
                        text: `🧟‍♀️ ${baby.name}! ${baby.desc}`,
                        cost: baby.cost,
                        rep: baby.rep
                    });
                    s.rep = Math.max(0, Math.min(100, s.rep + baby.rep));
                    income += baby.cost;
                }

                // Reputation multiplier
                const repMult = 0.5 + (s.rep / 100);
                income = Math.floor(income * repMult);

                totalIncome += Math.max(0, income);
            }
        });

        const profit = totalIncome - totalExpenses;
        this.money += profit;
        this.month++;

        this.events.push({
            type: profit >= 0 ? 'good' : 'bad',
            text: `Итоги: доход ${this.formatMoney(totalIncome)}, аренда ${this.formatMoney(totalExpenses)}, прибыль ${this.formatMoney(profit)}`
        });

        this.save();
        return this.money >= 0;
    }
}

const game = new Game();

function updateUI() {
    document.getElementById('month').textContent = game.month;
    document.getElementById('money').textContent = game.formatMoney(game.money);
    document.getElementById('city-pvz').textContent = game.cityPvz;
    document.getElementById('zombies').textContent = game.zombieCounter;

    if (game.money < 0) {
        showGameOver();
    }
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
                <span class="card-price">${game.formatMoney(s.price)}</span>
            </div>
            <div class="card-info">📍 ${s.address}</div>
            <div class="card-info">📐 ${s.area} м² | Аренда: ${game.formatMoney(s.rent)}/мес</div>
        `;
        card.onclick = () => buyStorage(s.id);
        list.appendChild(card);
    });
}

function renderStorages() {
    const list = document.getElementById('storages-list');
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
            const serviceInfo = SERVICES[s.serviceKey];
            statusHtml = `
                <span class="card-status ${serviceInfo.color}">${s.service}</span>
                <div class="card-info">💰 Доход: ${game.formatMoney(s.income)}/мес</div>
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
            <div class="card-info">📐 ${s.area} м² | Аренда: ${game.formatMoney(s.rent)}/мес</div>
            ${statusHtml}
        `;
        list.appendChild(card);
    });
}

function buyStorage(id) {
    if (game.buyStorage(id)) {
        updateUI();
        renderMarket();
        showModal('✅ Кладовка куплена!', `Теперь у тебя ${game.storages.length} кладовок.`);
    } else {
        showModal('❌ Не удалось купить', 'Недостаточно денег или кладовка уже продана.');
    }
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
                        <span class="card-price">${game.formatMoney(svc.cost)}</span>
                    </div>
                    <div class="card-info">
                        ${svc.multiplier > 1 ? '🔥 Высокая маржа (+30%)' : svc.multiplier < 1 ? '⚠️ Рискованно (-20%)' : '✅ Средний риск'}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function openPvz(storageId, serviceKey) {
    const service = SERVICES[serviceKey];
    if (game.openPvz(storageId, serviceKey)) {
        closeModal();
        updateUI();
        renderStorages();
        showModal('✅ ПВЗ открыт!', `${service.name} работает! Ожидаемый доход: ${game.formatMoney(game.storages.find(s => s.id === storageId).income)}/мес`);
    } else {
        showModal('❌ Ошибка', 'Недостаточно денег или кладовка занята.');
    }
}

function nextMonth() {
    const survived = game.nextMonth();
    updateUI();
    renderStorages();
    
    const eventsSection = document.getElementById('events-section');
    const eventsList = document.getElementById('events-list');
    eventsSection.classList.remove('hidden');
    
    eventsList.innerHTML = game.events.map(e => `
        <div class="event event-${e.type}">
            ${e.text}
            ${e.cost ? `<br><small>💰 ${game.formatMoney(e.cost)} | ⭐ ${e.rep > 0 ? '+' : ''}${e.rep}</small>` : ''}
        </div>
    `).join('');
    
    if (!survived) {
        showGameOver();
    }
}

function showGameOver() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="game-over">
            <div class="baby-zombie-icon">💀</div>
            <h2>БАНКРОТСТВО!</h2>
            <p>Ты выдержал ${game.month} месяцев</p>
            <p>Встречено баб-зомби: ${game.zombieCounter}</p>
            <button class="btn btn-primary" onclick="restartGame()" style="margin-top: 20px;">
                🔄 Новая игра
            </button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function restartGame() {
    game.reset();
    game.save();
    closeModal();
    updateUI();
    renderMarket();
    renderStorages();
    document.getElementById('events-section').classList.add('hidden');
}

function showModal(title, text) {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `<h3>${title}</h3><p>${text}</p>`;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// Event listeners
document.getElementById('btn-market').onclick = () => {
    renderMarket();
    document.getElementById('market-section').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('btn-storages').onclick = () => {
    renderStorages();
    document.getElementById('storages-section').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('btn-next').onclick = nextMonth;
document.getElementById('btn-restart').onclick = restartGame;
document.querySelector('.close').onclick = closeModal;

// Close modal on outside click
document.getElementById('modal').onclick = (e) => {
    if (e.target.id === 'modal') closeModal();
};

// Init
updateUI();
renderMarket();
renderStorages();
