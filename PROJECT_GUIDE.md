# PROJECT_GUIDE.md — Kneep

## Опис
Веб-інтерфейс для керування Jukebox-режимом Navidrome. React SPA зі стилем Winamp.

## Архітектура

```
src/
  api/subsonic.js          — Subsonic API клієнт (auth, jukebox control, scrobble)
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

## Конфігурація
- `navidrome.toml` — налаштування Navidrome сервера
- `docker-compose.yml` — Docker-сервіси
- `nginx.default.conf` — HTTPS proxy
- `.env` — секрети Last.fm (див `.env.example`)
