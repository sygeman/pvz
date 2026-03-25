# 🧟‍♀️ БАБЫ-ЗОМБИ — Мультиплеер Кликер

Кликай по бабам-шопоголикам, зарабатывай деньги, соревнуйся с друзьями.

## 🎮 Как играть

1. Зайди: `https://твой-сайт.com`
2. Введи имя и название комнаты
3. КЛИКАЙ ПО БАБЕ БЫСТРЕЕ!
4. Кто убьёт — получит деньги

## 🧟‍♀️ Типы баб

| Баба | HP | Награда | Особенность |
|------|-----|---------|-------------|
| Тётя Галя | 10 | 100₽ | Классика |
| Бабушка | 15 | 150₽ | Много тапочек |
| Мамочка | 20 | 200₽ | Ничего не берёт |
| Шопоголик | 25 | 300₽ | Любит акции |
| **МЕГА-БАБА** | 100 | 1000₽ | BOSS! |

## 🚀 Запуск

```bash
# Установи Bun
curl -fsSL https://bun.sh/install | bash

# Запусти
bun install
cd client && bun install && bun run build && cd ..
bun run start
```

## 🏗️ Деплой на Railway

1. Форкни репозиторий или подключи GitHub к Railway
2. Railway автоматически использует `Dockerfile` (Bun runtime)
3. Статические файлы собираются при сборке образа
4. Health check на `/api/health`

Через CLI:
```bash
railway login
railway link
railway up
```

### Docker локально

```bash
docker build -t kladochnik .
docker run -p 3000:3000 kladochnik
```

## 🛠️ Технологии

- **Backend**: Bun + Hono
- **Frontend**: Vue 3 (Single File Component)
- **Multiplayer**: Server-Sent Events (SSE)
- **Realtime**: Клики синхронизируются между игроками

## 📝 Фичи

- ⚡ Мгновенная синхронизация кликов
- 🏆 Топ игроков в реальном времени
- 💬 Kill feed (кто убил бабу)
- 📱 Работает на телефоне

---

*Сделано для PatriotDev*
