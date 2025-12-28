// ---------- SCREENS ----------
const screens = {
  start: document.getElementById("screen-start"),
  config: document.getElementById("screen-config"),
  role: document.getElementById("screen-role"),
  roundEnd: document.getElementById("screen-round-end"),
  end: document.getElementById("screen-end"),
};

// ---------- BUTTONS ----------
const btnStart = document.getElementById("btn-start");
const btnConfigNext = document.getElementById("btn-config-next");
const btnShowRole = document.getElementById("btn-show-role");
const btnNextPlayer = document.getElementById("btn-next-player");
const btnNextRound = document.getElementById("btn-next-round");
const btnEndGame = document.getElementById("btn-end-game");
const btnRestart = document.getElementById("btn-restart");

// ---------- INPUTS ----------
const playersInput = document.getElementById("players");
const impostorsInput = document.getElementById("impostors");
const roundsInput = document.getElementById("rounds");
const themeSelect = document.getElementById("theme");
const customWordsContainer = document.getElementById("custom-words-container");
const customWordsInput = document.getElementById("custom-words");

// ---------- ROLE / ROUND ----------
const playerTitle = document.getElementById("player-title");
const roundIndicator = document.getElementById("round-indicator");
const roleOverlay = document.getElementById("role-overlay");
const roleText = document.getElementById("role-text");
const roundTitle = document.getElementById("round-title");

// ---------- WORDS (se cargan desde JSON) ----------
let WORDS = {};

// ---------- GAME STATE ----------
let game = {};

// ---------- HELPERS ----------
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function saveGame() {
  localStorage.setItem("impostor-game", JSON.stringify(game));
}

function clearGame() {
  localStorage.removeItem("impostor-game");
}

// ---------- LOAD WORDS ----------
fetch("data/words.json")
  .then(res => res.json())
  .then(data => {
    WORDS = data;
    populateThemes();
  })
  .catch(err => {
    console.error("Error cargando words.json", err);
  });

function populateThemes() {
  themeSelect.innerHTML = "";

  Object.keys(WORDS).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    themeSelect.appendChild(option);
  });

  // Opción personalizada
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Personalizado";
  themeSelect.appendChild(custom);
}

// ---------- EVENTS ----------
btnStart.onclick = () => showScreen("config");

themeSelect.onchange = () => {
  customWordsContainer.classList.toggle(
    "hidden",
    themeSelect.value !== "custom"
  );
};

btnConfigNext.onclick = () => {
  game = {
    players: parseInt(playersInput.value),
    impostors: parseInt(impostorsInput.value),
    totalRounds: parseInt(roundsInput.value),
    currentRound: 1,
    roles: [],
    currentPlayer: 0,
  };

  startRound();
  saveGame();
};

// ---------- GAME LOGIC ----------
function startRound() {
  game.currentPlayer = 0;

  let words;
  if (themeSelect.value === "custom") {
    words = customWordsInput.value
      .split("\n")
      .map(w => w.trim())
      .filter(Boolean);
  } else {
    words = WORDS[themeSelect.value];
  }

  if (!words || words.length === 0) {
    alert("No hay palabras disponibles para este tema");
    return;
  }

  const word = words[Math.floor(Math.random() * words.length)];
  const roles = Array(game.players).fill(word);

  let assigned = 0;
  while (assigned < game.impostors) {
    const idx = Math.floor(Math.random() * game.players);
    if (roles[idx] !== "IMPOSTOR") {
      roles[idx] = "IMPOSTOR";
      assigned++;
    }
  }

  game.roles = roles;
  saveGame();
  showRoleScreen();
}

function showRoleScreen() {
  playerTitle.textContent = `Jugador ${game.currentPlayer + 1}`;
  roundIndicator.textContent =
    `Ronda ${game.currentRound} / ${game.totalRounds}`;

  showScreen("role");
}

btnShowRole.onclick = () => {
  roleText.className = "";

  if (game.roles[game.currentPlayer] === "IMPOSTOR") {
    roleText.textContent = "ERES EL IMPOSTOR";
    roleText.classList.add("role-impostor");
  } else {
    roleText.innerHTML = `La palabra es: <span class="word-highlight">
      ${game.roles[game.currentPlayer]}
    </span>`;
  }

  roleOverlay.classList.remove("hidden");
};

btnNextPlayer.onclick = () => {
  roleOverlay.classList.add("hidden");
  game.currentPlayer++;
  saveGame();

  if (game.currentPlayer >= game.players) {
    showEndOfRound();
  } else {
    showRoleScreen();
  }
};

function showEndOfRound() {
  roundTitle.textContent = `Fin de la ronda ${game.currentRound}`;

  btnNextRound.classList.toggle(
    "hidden",
    game.currentRound >= game.totalRounds
  );

  showScreen("roundEnd");
}

btnNextRound.onclick = () => {
  game.currentRound++;
  saveGame();
  startRound();
};

btnEndGame.onclick = () => {
  clearGame();
  showScreen("end");
};

btnRestart.onclick = () => {
  clearGame();
  showScreen("start");
};

// ---------- RESTORE GAME ----------
const savedGame = localStorage.getItem("impostor-game");

if (savedGame) {
  game = JSON.parse(savedGame);

  if (game.currentPlayer < game.players) {
    showRoleScreen();
  } else if (game.currentRound <= game.totalRounds) {
    showEndOfRound();
  } else {
    showScreen("end");
  }
}
