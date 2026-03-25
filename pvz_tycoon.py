#!/usr/bin/env python3
"""
КЛАДОВОЧНИК: Тайкун ПВЗ
Покупай кладовки, открывай пункты выдачи, стань магнатом доставки
"""

import random
import os
import time
from dataclasses import dataclass, field
from typing import List
from enum import Enum

class DeliveryService(Enum):
    OZON = "Ozon"
    WILDBERRIES = "Wildberries"
    YANDEX = "Яндекс.Маркет"

@dataclass
class Storage:
    """Кладовка"""
    id: int
    address: str
    area_sqm: int  # площадь в м²
    price: int  # стоимость покупки
    rent: int  # аренда в месяц
    has_pvz: bool = False
    service: DeliveryService = None
    monthly_income: int = 0
    reputation: int = 50  # 0-100
    
    def __str__(self):
        status = f"[{self.service.value}]" if self.has_pvz else "[ПУСТО]"
        return f"Кладовка #{self.id}: {self.address}, {self.area_sqm}м² {status}"

@dataclass
class Game:
    """Состояние игры"""
    money: int = 500000  # Стартовый капитал
    month: int = 1
    reputation: int = 50
    storages: List[Storage] = field(default_factory=list)
    
    def show_stats(self):
        """Показать статистику"""
        print("=" * 50)
        print(f"📊 МЕСЯЦ: {self.month} | 💰 БАЛАНС: {self.money:,}₽")
        print(f"⭐ РЕПУТАЦИЯ: {self.reputation}/100")
        print(f"🏭 КЛАДОВОК: {len(self.storages)} | 🏪 ПВЗ: {sum(1 for s in self.storages if s.has_pvz)}")
        print("=" * 50)
        
    def show_storages(self):
        """Показать свои кладовки"""
        if not self.storages:
            print("У вас пока нет кладовок!")
            return
        
        print("\n🏭 ВАШИ КЛАДОВКИ:")
        print("-" * 50)
        for s in self.storages:
            income = f"+{s.monthly_income:,}₽/мес" if s.has_pvz else "нет дохода"
            print(f"  #{s.id}: {s.address}")
            print(f"      Площадь: {s.area_sqm}м² | Доход: {income}")
            if s.has_pvz:
                print(f"      Сервис: {s.service.value} | Репутация: {s.reputation}/100")
            print()

class PVZGame:
    """Игра ПВЗ Тайкун"""
    
    ADDRESSES = [
        "ул. Ленина, 15 (подвал)",
        "пр. Карла Маркса, 42 (цоколь)",
        "ул. Куйбышева, 7 (1 этаж)",
        "ул. Антикайнена, 23 (помещение)",
        "пр. Первомайский, 88 (тех.этаж)",
        "ул. Федосова, 5 (цоколь)",
        "ул. Красная, 31 (подвал)",
        "пр. Лососинское, 156 (1 этаж)",
    ]
    
    EVENTS = [
        ("Курьер опоздал на 3 часа, клиенты возмущены", -5, -5000),
        ("Праздничный бум! Заказов в 2 раза больше", +10, +15000),
        ("Соседи жалуются на шум, проверка", -3, -2000),
        ("Положительный отзыв в локальной группе", +5, +3000),
        ("Поломка холодильника, часть товара испортилась", -8, -8000),
        ("Новый ЖК рядом заселился, поток клиентов вырос", +15, +20000),
        ("Конкурент открылся через дорогу", -10, -5000),
        ("Сезон распродаж, ажиотаж", +20, +25000),
    ]
    
    # Бабы-зомби - специальные события
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
    
    def __init__(self):
        self.game = Game()
        self.available_storages = self._generate_storages(5)
        self.city_pvz_count = 12  # ПВЗ уже есть в городе (конкуренция)
        self.zombie_baby_counter = 0  # Счетчик встреченных баб-зомби
        
    def _generate_storages(self, count: int) -> List[Storage]:
        """Сгенерировать случайные кладовки на рынке"""
        storages = []
        used_addresses = set()
        
        for i in range(count):
            addr = random.choice([a for a in self.ADDRESSES if a not in used_addresses])
            used_addresses.add(addr)
            
            area = random.choice([12, 15, 18, 20, 25, 30, 35])
            price = area * random.randint(80000, 120000)  # 80-120к за м²
            rent = area * random.randint(800, 1500)  # 800-1500₽/м² в месяц
            
            storages.append(Storage(
                id=i+1,
                address=addr,
                area_sqm=area,
                price=price,
                rent=rent
            ))
        return storages
    
    def clear_screen(self):
        os.system('clear' if os.name != 'nt' else 'cls')
    
    def show_market(self):
        """Показать рынок кладовок"""
        print("\n🏪 РЫНОК КЛАДОВОК:")
        print("-" * 60)
        for s in self.available_storages:
            print(f"  [{s.id}] {s.address}")
            print(f"      Площадь: {s.area_sqm}м² | Цена: {s.price:,}₽ | Аренда: {s.rent:,}₽/мес")
            print()
    
    def buy_storage(self, storage_id: int):
        """Купить кладовку"""
        storage = next((s for s in self.available_storages if s.id == storage_id), None)
        if not storage:
            print("❌ Кладовка не найдена!")
            return
        
        if self.game.money < storage.price:
            print("❌ Недостаточно денег!")
            return
        
        self.game.money -= storage.price
        self.game.storages.append(storage)
        self.available_storages.remove(storage)
        
        print(f"✅ Куплена кладовка #{storage.id} за {storage.price:,}₽")
        print(f"   Теперь у вас {len(self.game.storages)} кладовок")
        
        # Добавляем новую на рынок
        self.available_storages.extend(self._generate_storages(1))
    
    def open_pvz(self, storage_id: int):
        """Открыть ПВЗ в кладовке"""
        storage = next((s for s in self.game.storages if s.id == storage_id), None)
        if not storage:
            print("❌ Кладовка не найдена!")
            return
        
        if storage.has_pvz:
            print("❌ Здесь уже есть ПВЗ!")
            return
        
        if storage.area_sqm < 15:
            print("❌ Слишком маленькая кладовка (минимум 15м²)!")
            return
        
        print("\nВыберите сервис:")
        print("  [1] Ozon (низкий порог входа, средняя маржа)")
        print("  [2] Wildberries (высокая маржа, жёсткие требования)")
        print("  [3] Яндекс.Маркет (новый игрок, рискованно)")
        
        choice = input("> ").strip()
        
        services = {
            "1": (DeliveryService.OZON, 50000),
            "2": (DeliveryService.WILDBERRIES, 80000),
            "3": (DeliveryService.YANDEX, 40000)
        }
        
        if choice not in services:
            print("❌ Неверный выбор!")
            return
        
        service, setup_cost = services[choice]
        
        if self.game.money < setup_cost:
            print(f"❌ Нужно {setup_cost:,}₽ на оборудование!")
            return
        
        self.game.money -= setup_cost
        storage.has_pvz = True
        storage.service = service
        
        # Расчёт дохода
        base_income = storage.area_sqm * random.randint(2000, 3500)
        if service == DeliveryService.WILDBERRIES:
            base_income = int(base_income * 1.3)
        elif service == DeliveryService.YANDEX:
            base_income = int(base_income * 0.8)
        
        storage.monthly_income = base_income
        
        print(f"✅ Открыт ПВЗ {service.value}!")
        print(f"   Затраты на оборудование: {setup_cost:,}₽")
        print(f"   Ожидаемый доход: {base_income:,}₽/мес")
    
    def next_month(self):
        """Следующий месяц"""
        print(f"\n📅 МЕСЯЦ {self.game.month} ЗАВЕРШЁН...")
        time.sleep(1)
        
        # Новые ПВЗ открываются в городе (конкуренция растёт)
        new_pvz = random.randint(1, 3)
        self.city_pvz_count += new_pvz
        print(f"\n🏪 В городе открылось {new_pvz} новых ПВЗ!")
        print(f"   Всего ПВЗ в городе: {self.city_pvz_count} (конкуренция жёсткая)")
        
        # Считаем доходы и расходы
        total_income = 0
        total_expenses = 0
        
        for s in self.game.storages:
            # Аренда
            total_expenses += s.rent
            
            if s.has_pvz:
                # Доход ПВЗ (уменьшается из-за конкуренции)
                competition_factor = max(0.3, 1 - (self.city_pvz_count * 0.02))
                income = int(s.monthly_income * competition_factor)
                
                # Шанс встретить бабу-зомби (20%)
                if random.random() < 0.20:
                    baby = random.choice(self.BABY_ZOMBIES)
                    self.zombie_baby_counter += 1
                    print(f"\n   🧟‍♀️ БАБА-ЗОМБИ АТАКУЕТ!")
                    print(f"   {baby['name']}")
                    print(f"   Заказов: {baby['orders']} | Забрала: {baby['taken']}")
                    print(f"   {baby['desc']}")
                    print(f"   Ущерб: {baby['cost']:,}₽ | Репутация: {baby['rep']}")
                    
                    s.reputation = max(0, min(100, s.reputation + baby['rep']))
                    income += baby['cost']
                
                # Обычные случайные события (15% шанс)
                elif random.random() < 0.15:
                    event_text, rep_change, money_change = random.choice(self.EVENTS)
                    print(f"   📢 {event_text}")
                    s.reputation = max(0, min(100, s.reputation + rep_change))
                    income += money_change
                
                # Репутация влияет на доход
                rep_multiplier = 0.5 + (s.reputation / 100)
                income = int(income * rep_multiplier)
                
                total_income += max(0, income)
        
        # Итоги месяца
        profit = total_income - total_expenses
        self.game.money += profit
        self.game.month += 1
        
        print(f"\n💰 ИТОГИ МЕСЯЦА:")
        print(f"   Доход от ПВЗ: +{total_income:,}₽")
        print(f"   Расходы на аренду: -{total_expenses:,}₽")
        print(f"   Прибыль: {profit:+,}₽")
        print(f"   Баб-зомби встречено: {self.zombie_baby_counter}")
        
        if self.game.money < 0:
            print("\n💀 БАНКРОТСТВО! Игра окончена.")
            print(f"   Ты выдержал {self.game.month} месяцев")
            print(f"   и встретил {self.zombie_baby_counter} баб-зомби")
            return False
        
        input("\nНажми Enter для продолжения...")
        return True
    
    def run(self):
        """Главный цикл игры"""
        print("""
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     🏪 КЛАДОВОЧНИК 2.0: Бабы-Зомби 🧟‍♀️           ║
║                                                   ║
║  Открой ПВЗ → Выдержи атаку баб → Не обанкроться ║
║                                                   ║
║  ⚠️ В городе уже {city_pvz} ПВЗ (конкуренция!)    ║
║  ⚠️ Бабы заказывают 50 вещей и забирают 1        ║
╚═══════════════════════════════════════════════════╝
        """.format(city_pvz=self.city_pvz_count))
        
        print("💡 СОВЕТ: Бабы-зомби приходят в 20% случаев.")
        print("   Каждая тётка с 50 заказами = минус репутация и деньги.")
        print("   Чем больше ПВЗ в городе, тем меньше доход.\n")
        
        while True:
            self.clear_screen()
            self.game.show_stats()
            
            print("\n📋 МЕНЮ:")
            print("   [1] 🏪 Рынок кладовок (купить)")
            print("   [2] 🏭 Мои кладовки")
            print("   [3] 🚀 Открыть ПВЗ")
            print("   [4] 📅 Следующий месяц")
            print("   [0] 🚪 Выйти")
            
            choice = input("\n> ").strip()
            
            if choice == "1":
                self.show_market()
                print(f"💰 У вас {self.game.money:,}₽")
                sid = input("Какую купить? (ID или 0 для отмены): ").strip()
                if sid != "0":
                    try:
                        self.buy_storage(int(sid))
                    except ValueError:
                        print("❌ Введите число!")
                input("\nНажми Enter...")
                
            elif choice == "2":
                self.game.show_storages()
                input("\nНажми Enter...")
                
            elif choice == "3":
                if not self.game.storages:
                    print("❌ Сначала купите кладовку!")
                else:
                    self.game.show_storages()
                    sid = input("В какой открыть ПВЗ? (ID или 0): ").strip()
                    if sid != "0":
                        try:
                            self.open_pvz(int(sid))
                        except ValueError:
                            print("❌ Введите число!")
                input("\nНажми Enter...")
                
            elif choice == "4":
                if not self.next_month():
                    break
                    
            elif choice == "0":
                print("👋 До свидания!")
                break

if __name__ == "__main__":
    game = PVZGame()
    game.run()
