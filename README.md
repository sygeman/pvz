# КЛАДОВОЧНИК 2.0: Мультиплеер

Игра про ПВЗ и баб-зомби. Теперь с мультиплеером!

## 🎮 Играть

https://pvz-nine.vercel.app/

## 🧟‍♀️ Концепт

Открывай ПВЗ в Петрозаводске, соревнуйся с друзьями. Кто выживет дольше среди баб-шопоголиков?

### Бабы-Зомби

Каждый месяц с шансом 20% на твой ПВЗ нападает:

- **Тётя Галя** — 50 заказов, забирает 1 чехол
- **Бабушка** — 30 пар тапочек, берёт 2 дешёвые  
- **Мамочка** — 25 позиций, ничего не берёт, только нарекаёт
- **Шопоголик** — 40 позиций по акциям, отказывается от 37

## 🚀 Мультиплеер

### Как играть вместе

1. Договоритесь о названии комнаты (любое слово)
2. Зайдите по ссылке:
   ```
   https://pvz-nine.vercel.app/?room=НАЗВАНИЕ_КОМНАТЫ&name=ВАШЕ_ИМЯ
   ```

Пример:
```
https://pvz-nine.vercel.app/?room=ptz2026&name=Антон
```

### Фичи мультиплеера

- **Общий рынок** — когда кто-то покупает кладовку, она пропадает для всех
- **Чат** — общайтесь в реальном времени
- **Лидерборд** — следи за балансом других игроков
- **События** — видишь, когда другие открывают ПВЗ или ходят в новый месяц

## 🏗️ Деплой своего сервера

Если хочешь поднять свой сервер (например, на Railway или Render):

### 1. Форкни репу

### 2. Railway (рекомендую)

```bash
# Установи Railway CLI
npm i -g @railway/cli

# Залогинься
railway login

# Инициализируй проект
cd pvz
railway init

# Деплой
railway up
```

Railway автоматически определит Node.js и запустит `server.js`.

### 3. Или Render

- New Web Service
- Connect GitHub repo
- Build Command: `npm install`
- Start Command: `node server.js`
- Environment: `NODE_ENV=production`

### 4. Или локально

```bash
git clone https://github.com/sygeman/pvz.git
cd pvz
npm install
npm start
```

Открой http://localhost:3000

## 📝 Структура

```
├── index.html      # Клиент
├── style.css       # Стили
├── game.js         # Клиентская логика + Socket.io
├── server.js       # Сервер Node.js + Socket.io
├── package.json    # Зависимости
└── README.md       # Этот файл
```

## 🛠️ Технологии

- **Frontend**: Vanilla JS, Socket.io-client
- **Backend**: Node.js, Express, Socket.io
- **Хостинг**: Vercel (frontend) + Railway/Render (backend)

## ⚠️ Важно

Vercel не поддерживает WebSockets на бесплатном тарифе. Поэтому:
- **Фронтенд** можно хостить на Vercel (уже сделано)
- **Сервер** нужен отдельный (Railway, Render, Heroku и т.д.)

Если деплоишь свой сервер — обнови URL сервера в `game.js`:
```javascript
const socket = io('https://твой-сервер.railway.app');
```

---

*Сделано для PatriotDev*
