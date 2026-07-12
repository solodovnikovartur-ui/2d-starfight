# 2D Starfight

Заготовка для 2D-игры на HTML + CSS + TypeScript + Vue.js.

> Браузеры не выполняют TypeScript напрямую — проект собирается через [Vite](https://vite.dev/) в обычный JavaScript.

## Быстрый старт

```bash
npm install
npm run dev
```

Откроется локальный сервер с горячей перезагрузкой.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер для разработки |
| `npm run build` | Сборка в папку `dist/` |
| `npm run preview` | Просмотр production-сборки |

## Структура

```
src/
  App.vue              — корневой компонент (игровое поле + HUD)
  main.ts              — точка входа Vue
  style.css            — глобальные стили
  components/
    GameHud.vue        — интерфейс поверх игры
  game/
    Game.ts            — игровой цикл
    Input.ts           — клавиатура
    types.ts           — общие типы
```

## Что уже есть

- Vue 3 для UI и игровых объектов
- HTML + CSS вместо Canvas (проще для старта)
- Игровое поле 640×360
- Игровой цикл с delta time
- Обработка ввода (WASD / стрелки) — `Input.ts`
- Базовый HUD
