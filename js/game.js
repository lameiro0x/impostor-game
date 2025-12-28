const screens = {
  start: document.getElementById("screen-start"),
  config: document.getElementById("screen-config"),
  role: document.getElementById("screen-role"),
  end: document.getElementById("screen-end"),
};

const btnStart = document.getElementById("btn-start");
const btnConfigNext = document.getElementById("btn-config-next");
const btnShowRole = document.getElementById("btn-show-role");
const btnNextPlayer = document.getElementById("btn-next-player");
const btnRestart = document.getElementById("btn-restart");

const playersInput = document.getElementById("players");
const impostorsInput = document.getElementById("impostors");
const themeSelect = document.getElementById("theme");
const customWordsContainer = document.getElementById("custom-words-container");
const customWordsInput = document.getElementById("custom-words");

const playerTitle = document.getElementById("player-title");
const roleResult = document.getElementById("role-result");
const roleText = document.getElementById("role-text");

let game = {};

const WORDS = {
  food: ["Pizza", "Hamburguesa", "Sushi", "Paella"],
  places: ["Playa", "Montaña", "Aeropuerto", "Cine"],
};

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
  const players = parseInt(playersInput.value);
  const impostors = parseInt(impostorsInput.value);

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
  const roles = Array(players).fill(word);

  for (let i = 0; i < impostors; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * players);
    } while (roles[idx] === "IMPOSTOR");
    roles[idx] = "IMPOSTOR";
  }

  game = {
    players,
    roles,
    current: 0,
  };

  roleResult.classList.add("hidden");
  showRoleScreen();
};

function showRoleScreen() {
  playerTitle.textContent = `Jugador ${game.current + 1}`;
  showScreen("role");
}

btnShowRole.onclick = () => {
  roleText.textContent =
    game.roles[game.current] === "IMPOSTOR"
      ? "Eres el IMPOSTOR"
      : `La palabra es: ${game.roles[game.current]}`;

  roleResult.classList.remove("hidden");
};

btnNextPlayer.onclick = () => {
  game.current++;
  roleResult.classList.add("hidden");

  if (game.current >= game.players) {
    showScreen("end");
  } else {
    showRoleScreen();
  }
};

btnRestart.onclick = () => showScreen("start");
