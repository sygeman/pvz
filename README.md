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

## 🏗️ Деплой

### Railway (рекомендую)

```bash
railway init
railway up
```

### Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN cd client && bun install && bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
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
