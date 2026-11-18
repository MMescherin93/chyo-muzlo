# app — единое приложение «Чьё музло?!» (PWA + Capacitor)

Одно приложение на все роли:

- **Хост** — создаёт комнату, показывает QR/код, играет музыку (iframe ЯМузыки), ведёт раунды.
- **Гость** — открывает тот же адрес, вводит код и ник, кидает ссылки, голосует.

Работает в браузере и собирается в **APK** через Capacitor. Настроек и ключей нет — синхронизация идёт через публичные MQTT-брокеры.

## Структура

```
app/
├── index.html
├── vite.config.ts
├── capacitor.config.ts
├── public/
│   └── manifest.webmanifest
├── android/                 # нативный проект Capacitor (для APK)
└── src/
    ├── main.tsx
    ├── App.tsx              # лендинг → host / guest
    ├── Landing.tsx
    ├── sync.ts              # MQTT: брокеры, HostController, GuestSync
    ├── room-view.ts         # снимок комнаты для UI/сети
    ├── host/HostApp.tsx     # экраны хоста
    ├── guest/GuestApp.tsx   # маршрутизация гостя
    ├── pages/               # Join, Lobby, Vote, Reveal, Final
    └── theme.css
```

## Команды

```bash
npm run dev              # локально (http://localhost:5173)
npm run dev -- --host    # доступно с телефона по IP
npm run build            # сборка в dist/
npm run typecheck
```

Сборка APK — см. [../SETUP.md](../SETUP.md), раздел 4.
