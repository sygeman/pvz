# КЛАДОВОЧНИК 2.0

Игра про ПВЗ и баб-зомби на Bun + Vue 3 + GitHub OAuth.

## 🚀 Запуск

```bash
# Установи Bun
curl -fsSL https://bun.sh/install | bash

# Клонируй
git clone https://github.com/sygeman/pvz.git
cd pvz

# Установи зависимости
bun install
cd client && bun install && cd ..

# Собери клиент
bun run build

# Запусти сервер
bun run start
```

## ⚙️ Настройка GitHub OAuth

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: `Кладовочник`
3. Homepage URL: `http://localhost:3000`
4. Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
5. Создай файл `.env`:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
BASE_URL=http://localhost:3000
PORT=3000
```

## 📁 Структура

```
├── server.js           # Bun сервер (Hono)
├── package.json
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── store.js      # Pinia store
│       ├── style.css
│       └── components/
│           ├── AuthView.vue
│           ├── GameView.vue
│           ├── MarketView.vue
│           ├── StoragesView.vue
│           ├── EventsView.vue
│           ├── PvzModal.vue
│           └── StatCard.vue
```

## 🛠️ Технологии

- **Backend**: Bun + Hono
- **Frontend**: Vue 3 + Pinia + Vite
- **Auth**: GitHub OAuth
- **State**: Pinia (клиент) + in-memory (сервер)

## 📝 Фичи

- Авторизация через GitHub
- Сохранение прогресса на сервере
- Игра с любого устройства
- Бабы-зомби с уникальными атаками

---

*Сделано для PatriotDev*
