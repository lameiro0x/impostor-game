const screens = {
  start: document.getElementById("screen-start"),
  config: document.getElementById("screen-config"),
  role: document.getElementById("screen-role"),
  roundEnd: document.getElementById("screen-round-end"),
  end: document.getElementById("screen-end"),
};

const btnStart = document.getElementById("btn-start");
const btnConfigNext = document.getElementById("btn-config-next");
const btnShowRole = document.getElementById("btn-show-role");
const btnNextPlayer = document.getElementById("btn-next-player");
const btnNextRound = document.getElementById("btn-next-round");
const btnEndGame = document.getElementById("btn-end-game");
const btnRestart = document.getElementById("btn-restart");

const playersInput = document.getElementById("players");
const impostorsInput = document.getElementById("impostors");
const roundsInput = document.getElementById("rounds");
const themeSelect = document.getElementById("theme");
const customWordsContainer = document.getElementById("custom-words-container");
const customWordsInput = document.getElementById("custom-words");

const playerTitle = document.getElementById("player-title");
const roundIndicator = document.getElementById("round-indicator");
const roleOverlay = document.getElementById("role-overlay");
const roleText = document.getElementById("role-text");
const roundTitle = document.getElementById("round-title");

const WORDS = {
  food: ["Pizza", "Hamburguesa", "Sushi", "Paella"],
  places: ["Playa", "Montaña", "Aeropuerto", "Cine"],
};

let game = {};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

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
};

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
  showRoleScreen();
}

function showRoleScreen() {
  playerTitle.textContent = `Jugador ${game.currentPlayer + 1}`;
  roundIndicator.textContent =
    `Ronda ${game.currentRound} / ${game.totalRounds}`;

  showScreen("role");
}

btnShowRole.onclick = () => {
  roleText.textContent =
    game.roles[game.currentPlayer] === "IMPOSTOR"
      ? "Eres el IMPOSTOR"
      : `La palabra es: ${game.roles[game.currentPlayer]}`;

  roleOverlay.classList.remove("hidden");
};

btnNextPlayer.onclick = () => {
  roleOverlay.classList.add("hidden");
  game.currentPlayer++;

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
  startRound();
};

btnEndGame.onclick = () => showScreen("end");

btnRestart.onclick = () => showScreen("start");
