# Impostor Game – Vanilla JavaScript Web App

A lightweight web application inspired by social deduction games, built entirely with **vanilla JavaScript**, focusing on **clean architecture, UX clarity, and internationalization (i18n)** without relying on external frameworks.

The project is designed as a small but complete frontend application, demonstrating how to manage state, dynamic UI updates, and multilingual content in a simple and maintainable way.

---

## Features

- 🧠 Social deduction game logic (impostors vs players)
- 🌍 Internationalization (Spanish / English)
- 🎯 Dynamic themes and word sets loaded from JSON
- 💾 Game state persistence using `localStorage`
- 👤 Custom player names support
- 📊 Clear player and round progress indicators
- 📱 Responsive, mobile-friendly UI
- ⚙️ No frameworks, no dependencies (pure HTML, CSS, JS)

---

## Play the Application

The game is fully playable directly in the browser at:

👉 **https://play.lameiro0x.com**

No installation or setup is required.

---

## Project Structure

```
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── game.js
│   └── i18n.js
├── data/
│   └── words.json
├── favicon16.png
├── favicon32.png
├── apple-touch-icon.png
└── CNAME
```

---

## Technical Overview

### Internationalization (i18n)
- Language strings are defined in `js/i18n.js`
- Game themes and word sets are language-aware via `data/words.json`
- Language switching is handled at runtime without page reloads
- Selected language is persisted using `localStorage`

### Game Logic
- Roles are assigned randomly per round
- Supports multiple rounds and configurable number of impostors
- Custom word lists can be provided by the user
- Game progress is preserved across page refreshes

### Design Decisions
- **Vanilla JS only** to focus on fundamentals
- Clear separation between UI, game logic, and data
- Small scope, but fully finished and usable

---

## UX Considerations

The application is designed for real-world group usage, where a single device is passed between players.  
Special care was taken to avoid accidental information leaks, reduce misclicks, and keep the game flow clear and predictable throughout the session.

---

## Getting Started (Local Development)

No build step required.

```bash
git clone https://github.com/lameiro0x/impostor-game.git
cd impostor-game
python3 -m http.server
```

And yo can connect via your browser going to localhost.

---

## Motivation

This project was built as a practical exercise to reinforce frontend fundamentals, state management in small applications, and internationalization without external libraries.

---

## Author

Created by **lameiro0x**  
GitHub: https://github.com/lameiro0x  
Blog: https://blog.lameiro0x.com
