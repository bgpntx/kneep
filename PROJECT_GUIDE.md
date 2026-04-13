# PROJECT_GUIDE.md — Kneep

## Опис
Веб-інтерфейс для керування Jukebox-режимом Navidrome. React SPA зі стилем Winamp.

## Архітектура

```
src/
  api/subsonic.js          — Subsonic API клієнт (auth, jukebox control, scrobble, AI config)
  api/lastfm.js            — Last.fm API клієнт (top artists)
  api/aiPlaylist.js         — AI playlist генерація (Claude API, не використовується поки)
  components/QueueItem.jsx — Drag & drop елемент черги
  utils/md5.js             — MD5 хеш для автентифікації
  utils/helpers.js         — Форматування часу
  utils/playbackManager.js — Persistence стану відтворення (localStorage)
  App.jsx                  — Головний компонент (UI + логіка)
  App.css                  — Стилі
  main.jsx                 — Entry point
```

## Стек
- React 18 + Vite 5
- @dnd-kit (drag & drop для черги)
- Docker (Navidrome + Nginx)
- Jenkins CI/CD

## Розробка
```bash
npm install
npm run dev     # localhost:5173
npm run build   # production → dist/
```

## Деплой
```bash
bash rebuild.sh   # або через Jenkins
```
Jenkinsfile підключається по SSH і запускає `rebuild.sh`.

## AI Playlist (кнопка 🤖)
Генерує Up Next із 100 рандомних треків на основі Last.fm бібліотеки:
1. Отримує топ виконавців з Last.fm (500+ скроблів)
2. Шукає їх треки в Navidrome
3. Рандомно обирає 100 та додає в чергу

## Discovery Playlist (кнопка 💎)
Обернена функція до AI Playlist — генерує чергу з "прихованих перлин":
1. Отримує виконавців з Last.fm з <500 скроблів (макс. 1000 артистів, з кінця списку)
2. Перемішує список артистів та шукає їх треки в Navidrome (зупиняється після 300 знайдених)
3. Рандомно обирає 100 та додає в чергу

Обидві функції використовують одні й ті ж налаштування.

## Налаштування Last.fm
Налаштування (Last.fm Username + API Key) — через UI в браузері, зберігаються в localStorage.
Nginx проксює `/lastfm/` → `ws.audioscrobbler.com`.

## Конфігурація
- `navidrome.toml` — налаштування Navidrome сервера
- `docker-compose.yml` — Docker-сервіси
- `nginx.default.conf` — HTTPS proxy, проксі для Last.fm API
- `.env` — секрети Last.fm (див `.env.example`)

