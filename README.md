# Impostor Game – Offline & Online Multiplayer (Vanilla JavaScript)

A lightweight social deduction web application built entirely with **vanilla JavaScript**, designed with a strong focus on **clean architecture**, **clear UX**, **internationalization (i18n)**, and **explicit separation between offline and online flows**.

The project started as a single-device offline game and evolved into a **real-time online multiplayer application**, demonstrating how to build and deploy a small distributed system without frontend frameworks.

---

## Features

### Core Gameplay
- 🧠 Social deduction mechanics (impostors vs players)
- 🔁 Multiple configurable rounds
- 👤 Custom player names
- 🎯 Dynamic themes and word sets loaded from JSON
- ✍️ Custom word lists (offline and online)
- 📊 Clear player and round indicators

### Offline Mode
- Designed for **pass-and-play** on a single device
- Private role reveal per player
- Full game flow with no network dependency

### Online Multiplayer Mode
- 🌐 Real-time multiplayer using **Socket.IO**
- 🏠 Room-based system with join codes
- 👑 Host-authoritative game flow
- 🔒 Private role delivery per player
- 🔁 Restart with same or new settings without recreating the room
- 🔄 Basic reconnection support
- ⏱️ Synchronized countdowns and round transitions

### General
- 🌍 Internationalization (Spanish / English)
- 💾 Local state persistence using `localStorage`
- 📱 Responsive, mobile-friendly UI
- ⚙️ No frontend frameworks or build tools

---

## Play the Application

👉 **https://play.lameiro0x.com**

The game is fully playable directly in the browser, both offline and online.

---

## Architecture Overview

- **Frontend**: Static HTML/CSS/JS served from GitHub Pages
- **Backend**: Node.js + Socket.IO hosted on Render

The backend manages rooms, players, and game state, while the frontend focuses on UI and interaction.

---

## Project Structure

```
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── game.js
│   └── i18n.js
├── data/
│   └── words.json
├── server.js
├── package.json
├── package-lock.json
├── node_modules/
├── favicon16.png
├── favicon32.png
├── apple-touch-icon.png
├── CNAME
└── README.md
```

---

## Local Development

### Frontend
```bash
python3 -m http.server
```

### Backend
```bash
npm install
npm start
```

---

## Motivation

This project was built to strengthen frontend fundamentals, state management, and real-time communication concepts using a clean and minimal approach.

---

## Author

Created by **lameiro0x**  
GitHub: https://github.com/lameiro0x  
Blog: https://blog.lameiro0x.com
