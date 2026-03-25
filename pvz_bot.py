#!/usr/bin/env python3
"""
КЛАДОВОЧНИК BOT для Telegram
Игра прямо в чате через команды
"""

import json
import os
import random
from dataclasses import dataclass, asdict
from typing import Dict, Optional

DATA_FILE = "/root/.openclaw/workspace/pvz_players.json"

# Загрузка/сохранение данных
def load_players():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_players(players):
    with open(DATA_FILE, 'w') as f:
        json.dump(players, f, indent=2, ensure_ascii=False)

# Бабы-зомби
BABY_ZOMBIES = [
    {
        "name": "Тётя Галя с 50 заказами",
        "orders": 50,
        "taken": 1,
        "desc": "Пришла тётка с огромными пакетами, перебрала всё, забрала только чехол для телефона",
        "rep": -8,
        "cost": -15000
    },
    {
        "name": "Бабушка с 30 парами тапочек", 
        "orders": 30,
        "taken": 2,
        "desc": "Бабуля заказала 30 пар тапочек, померила все, забрала 2 самые дешёвые",
        "rep": -5,
        "cost": -8000
    },
    {
        "name": "Мамочка с детскими вещами",
        "orders": 25,
        "taken": 0,
        "desc": "Мама заказала кучу детской одежды, ничего не подошло, ушла с нареканиями",
        "rep": -10,
        "cost": -12000
    },
    {
        "name": "Шопоголик со скидками",
        "orders": 40,
        "taken": 3,
        "desc": "Девушка скупила всё по акциям, отказалась от 37 позиций",
        "rep": -6,
        "cost": -10000
    }
]

ADDRESSES = [
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
]

def get_new_player():
    return {
        "money": 500000,
        "month": 1,
        "pvz_count": 0,
        "city_pvz": 12,
        "zombie_counter": 0,
        "storages": [],
        "market": generate_market()
    }

def generate_market():
    """Сгенерировать рынок кладовок"""
    market = []
    used = []
    for i in range(5):
        addr = random.choice([a for a in ADDRESSES if a not in used])
        used.append(addr)
        area = random.choice([12, 15, 18, 20, 25, 30])
        price = area * random.randint(80000, 120000)
        rent = area * random.randint(800, 1500)
        market.append({
            "id": i + 1,
            "address": addr,
            "area": area,
            "price": price,
            "rent": rent,
            "has_pvz": False,
            "service": None,
            "income": 0,
            "rep": 50
        })
    return market

def format_money(m):
    return f"{m:,}₽".replace(",", " ")

def cmd_start(user_id, players):
    """Начать игру"""
    if user_id not in players:
        players[user_id] = get_new_player()
        save_players(players)
    
    p = players[user_id]
    return f"""🏪 КЛАДОВОЧНИК 2.0 - Бабы-Зомби

📊 Месяц: {p['month']}
💰 Баланс: {format_money(p['money'])}
🏭 Кладовок: {len(p['storages'])}
🏪 ПВЗ: {p['pvz_count']}
🧟‍♀️ Баб встречено: {p['zombie_counter']}

Команды:
/market - Рынок кладовок
/buy [ID] - Купить кладовку
/storages - Мои кладовки  
/open [ID] [ozon/wb/yandex] - Открыть ПВЗ
/next - Следующий месяц (тут приходят бабы)
/status - Статистика

⚠️ В городе уже {p['city_pvz']} ПВЗ (конкуренция!)"""

def cmd_market(user_id, players):
    """Показать рынок"""
    p = players[user_id]
    text = "🏪 РЫНОК КЛАДОВОК:\n\n"
    for s in p['market']:
        status = "[ЕСТЬ ПВЗ]" if s['has_pvz'] else "[СВОБОДНА]"
        text += f"[{s['id']}] {s['address']}\n"
        text += f"    Площадь: {s['area']}м² | Цена: {format_money(s['price'])}\n"
        text += f"    Аренда: {format_money(s['rent'])}/мес {status}\n\n"
    text += f"💰 У тебя: {format_money(p['money'])}"
    return text

def cmd_buy(user_id, players, storage_id):
    """Купить кладовку"""
    p = players[user_id]
    storage = next((s for s in p['market'] if s['id'] == storage_id), None)
    
    if not storage:
        return "❌ Кладовка не найдена!"
    
    if storage['has_pvz']:
        return "❌ Эта кладовка уже куплена!"
    
    if p['money'] < storage['price']:
        return f"❌ Нужно {format_money(storage['price'])}, у тебя {format_money(p['money'])}"
    
    p['money'] -= storage['price']
    storage['has_pvz'] = True  # Отмечаем как купленную
    p['storages'].append(storage.copy())
    
    # Добавляем новую на рынок
    new_id = max(s['id'] for s in p['market']) + 1
    addr = random.choice([a for a in ADDRESSES if a not in [s['address'] for s in p['market']]])
    area = random.choice([12, 15, 18, 20, 25, 30])
    p['market'].append({
        "id": new_id,
        "address": addr,
        "area": area,
        "price": area * random.randint(80000, 120000),
        "rent": area * random.randint(800, 1500),
        "has_pvz": False,
        "service": None,
        "income": 0,
        "rep": 50
    })
    
    save_players(players)
    return f"✅ Куплена кладовка #{storage_id} за {format_money(storage['price'])}\n💰 Осталось: {format_money(p['money'])}"

def cmd_storages(user_id, players):
    """Показать мои кладовки"""
    p = players[user_id]
    if not p['storages']:
        return "У тебя нет кладовок! Купи на /market"
    
    text = "🏭 ТВОИ КЛАДОВКИ:\n\n"
    for s in p['storages']:
        if s['service']:
            text += f"[{s['id']}] {s['address']}\n"
            text += f"    📦 {s['service'].upper()} | {s['area']}м²\n"
            text += f"    Доход: {format_money(s['income'])}/мес | Реп: {s['rep']}/100\n\n"
        else:
            text += f"[{s['id']}] {s['address']} ({s['area']}м²)\n"
            text += f"    [ПУСТО] - используй /open {s['id']} ozon/wb/yandex\n\n"
    return text

def cmd_open(user_id, players, storage_id, service):
    """Открыть ПВЗ"""
    p = players[user_id]
    storage = next((s for s in p['storages'] if s['id'] == storage_id), None)
    
    if not storage:
        return "❌ Кладовка не найдена!"
    
    if storage['service']:
        return "❌ Здесь уже есть ПВЗ!"
    
    if storage['area'] < 15:
        return "❌ Слишком маленькая кладовка (минимум 15м²)"
    
    services = {
        "ozon": ("Ozon", 50000, 1.0),
        "wb": ("Wildberries", 80000, 1.3),
        "yandex": ("Яндекс.Маркет", 40000, 0.8)
    }
    
    if service not in services:
        return "❌ Укажи сервис: ozon, wb или yandex"
    
    svc_name, cost, multiplier = services[service]
    
    if p['money'] < cost:
        return f"❌ Нужно {format_money(cost)} на оборудование!"
    
    p['money'] -= cost
    storage['service'] = svc_name
    base_income = storage['area'] * random.randint(2000, 3500)
    storage['income'] = int(base_income * multiplier)
    p['pvz_count'] += 1
    
    save_players(players)
    return f"✅ Открыт ПВЗ {svc_name}!\n💸 Оборудование: {format_money(cost)}\n📈 Доход: {format_money(storage['income'])}/мес"

def cmd_next(user_id, players):
    """Следующий месяц"""
    p = players[user_id]
    
    # Новые ПВЗ в городе
    new_pvz = random.randint(1, 3)
    p['city_pvz'] += new_pvz
    
    total_income = 0
    total_expenses = 0
    events_text = []
    
    for s in p['storages']:
        # Аренда
        total_expenses += s['rent']
        
        if s['service']:
            # Конкуренция снижает доход
            competition = max(0.3, 1 - (p['city_pvz'] * 0.02))
            income = int(s['income'] * competition)
            
            # Шанс бабы-зомби
            if random.random() < 0.20:
                baby = random.choice(BABY_ZOMBIES)
                p['zombie_counter'] += 1
                events_text.append(f"🧟‍♀️ {baby['name']}! {baby['desc'][:50]}...")
                s['rep'] = max(0, min(100, s['rep'] + baby['rep']))
                income += baby['cost']
            
            # Репутация
            rep_mult = 0.5 + (s['rep'] / 100)
            income = int(income * rep_mult)
            
            total_income += max(0, income)
    
    profit = total_income - total_expenses
    p['money'] += profit
    p['month'] += 1
    
    save_players(players)
    
    text = f"📅 МЕСЯЦ {p['month']-1} ЗАВЕРШЁН\n\n"
    text += f"🏪 Новых ПВЗ в городе: +{new_pvz} (всего: {p['city_pvz']})\n"
    if events_text:
        text += "\n🧟‍♀️ СОБЫТИЯ:\n" + "\n".join(events_text) + "\n"
    text += f"\n💰 Доход: +{format_money(total_income)}\n"
    text += f"💸 Аренда: -{format_money(total_expenses)}\n"
    text += f"📊 Прибыль: {format_money(profit)}\n"
    text += f"💵 Баланс: {format_money(p['money'])}\n"
    text += f"🧟‍♀️ Баб всего: {p['zombie_counter']}"
    
    if p['money'] < 0:
        text += "\n\n💀 БАНКРОТСТВО! Игра окончена. /start для новой игры"
        del players[user_id]
        save_players(players)
    
    return text

def cmd_status(user_id, players):
    """Статистика"""
    p = players[user_id]
    return f"""📊 СТАТИСТИКА

💰 Баланс: {format_money(p['money'])}
📅 Месяц: {p['month']}
🏭 Кладовок: {len(p['storages'])}
🏪 ПВЗ: {p['pvz_count']}
🧟‍♀️ Баб встречено: {p['zombie_counter']}
🏪 ПВЗ в городе: {p['city_pvz']} (конкуренция)"""

# CLI интерфейс для тестирования
def main():
    print("КЛАДОВОЧНИК BOT - тестовый режим")
    print("В реальном боте команды будут через /")
    print("")
    
    players = load_players()
    user_id = "test_user"
    
    while True:
        cmd = input("> ").strip().split()
        if not cmd:
            continue
        
        if cmd[0] == "start":
            print(cmd_start(user_id, players))
        elif cmd[0] == "market":
            print(cmd_market(user_id, players))
        elif cmd[0] == "buy" and len(cmd) > 1:
            print(cmd_buy(user_id, players, int(cmd[1])))
        elif cmd[0] == "storages":
            print(cmd_storages(user_id, players))
        elif cmd[0] == "open" and len(cmd) > 2:
            print(cmd_open(user_id, players, int(cmd[1]), cmd[2]))
        elif cmd[0] == "next":
            print(cmd_next(user_id, players))
        elif cmd[0] == "status":
            print(cmd_status(user_id, players))
        elif cmd[0] == "quit":
            break
        else:
            print("Команды: start, market, buy [id], storages, open [id] [ozon/wb/yandex], next, status, quit")

if __name__ == "__main__":
    main()
