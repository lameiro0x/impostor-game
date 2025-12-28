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
const btnLang = document.getElementById("btn-lang");

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

let WORDS = {};

let game = {};

const LANG_KEY = "impostor-lang";
const SUPPORTED_LANGS = ["es", "en"];

function resolveInitialLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (SUPPORTED_LANGS.includes(saved)) {
    return saved;
  }

  const browserLang = (navigator.language || "").toLowerCase();
  return browserLang.startsWith("es") ? "es" : "en";
}

let currentLang = resolveInitialLang();
document.documentElement.lang = currentLang;

function t(key) {
  if (I18N[currentLang] && Object.prototype.hasOwnProperty.call(I18N[currentLang], key)) {
    return I18N[currentLang][key];
  }
  if (I18N.es && Object.prototype.hasOwnProperty.call(I18N.es, key)) {
    return I18N.es[key];
  }
  return key;
}

function formatText(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return params[token];
    }
    return `{${token}}`;
  });
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  document.title = t("pageTitle");

  if (btnLang) {
    btnLang.textContent = currentLang.toUpperCase();
    btnLang.setAttribute("aria-label", t("langToggle"));
    btnLang.title = t("langToggle");
  }

  refreshDynamicText();
}

function refreshDynamicText() {
  if (!screens.role.classList.contains("hidden")) {
    updateRoleHeader();
  }
  if (!screens.roundEnd.classList.contains("hidden")) {
    updateRoundEndTitle();
  }
  if (!roleOverlay.classList.contains("hidden")) {
    renderRoleText();
  }
}

function updateRoleHeader() {
  if (
    !Number.isFinite(game.currentPlayer) ||
    !Number.isFinite(game.currentRound) ||
    !Number.isFinite(game.totalRounds)
  ) {
    return;
  }

  playerTitle.textContent = formatText(t("playerTitle"), {
    num: game.currentPlayer + 1,
  });
  roundIndicator.textContent = formatText(t("roundIndicator"), {
    current: game.currentRound,
    total: game.totalRounds,
  });
}

function updateRoundEndTitle() {
  if (!Number.isFinite(game.currentRound)) {
    return;
  }

  roundTitle.textContent = formatText(t("roundEndTitle"), {
    round: game.currentRound,
  });
}

function renderRoleText() {
  roleText.className = "";

  if (!game.roles || !Number.isFinite(game.currentPlayer)) {
    return;
  }

  if (game.roles[game.currentPlayer] === "IMPOSTOR") {
    roleText.textContent = t("impostor");
    roleText.classList.add("role-impostor");
  } else {
    roleText.innerHTML = `${t("wordIs")} <span class="word-highlight">
      ${game.roles[game.currentPlayer]}
    </span>`;
  }
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    return;
  }

  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
  populateThemes();
}

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
  if (!WORDS || Object.keys(WORDS).length === 0) {
    return;
  }

  const currentValue = themeSelect.value;
  themeSelect.innerHTML = "";

  Object.keys(WORDS).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = WORDS[key][currentLang] || WORDS[key].es || WORDS[key].en || key;
    themeSelect.appendChild(option);
  });

  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = t("customTheme");
  themeSelect.appendChild(custom);

  if (currentValue && (currentValue === "custom" || WORDS[currentValue])) {
    themeSelect.value = currentValue;
  }

  customWordsContainer.classList.toggle(
    "hidden",
    themeSelect.value !== "custom"
  );
}

if (btnLang) {
  btnLang.onclick = () => {
    setLanguage(currentLang === "es" ? "en" : "es");
  };
}

btnStart.onclick = () => showScreen("config");

themeSelect.onchange = () => {
  customWordsContainer.classList.toggle(
    "hidden",
    themeSelect.value !== "custom"
  );
};

btnConfigNext.onclick = () => {
  const players = parseInt(playersInput.value, 10);
  const impostors = parseInt(impostorsInput.value, 10);
  const totalRounds = parseInt(roundsInput.value, 10);
  const messages = currentLang === "en"
    ? {
      playersMin: "Players must be at least 3.",
      impostorsMin: "There must be at least 1 impostor.",
      impostorsMax: "Impostors must be fewer than players.",
      roundsMin: "Rounds must be at least 1.",
      customWordsMin: "Add at least 3 distinct custom words.",
    }
    : {
      playersMin: "Debe haber al menos 3 jugadores.",
      impostorsMin: "Debe haber al menos 1 impostor.",
      impostorsMax: "Los impostores deben ser menos que los jugadores.",
      roundsMin: "Debe haber al menos 1 ronda.",
      customWordsMin: "Añade al menos 3 palabras personalizadas distintas.",
    };

  if (!Number.isFinite(players) || players < 3) {
    alert(messages.playersMin);
    return;
  }

  if (!Number.isFinite(impostors) || impostors < 1) {
    alert(messages.impostorsMin);
    return;
  }

  if (impostors >= players) {
    alert(messages.impostorsMax);
    return;
  }

  if (!Number.isFinite(totalRounds) || totalRounds < 1) {
    alert(messages.roundsMin);
    return;
  }

  if (themeSelect.value === "custom") {
    const seen = new Set();
    const cleaned = customWordsInput.value
      .split("\n")
      .map(word => word.trim())
      .filter(word => {
        if (!word || seen.has(word)) {
          return false;
        }
        seen.add(word);
        return true;
      });

    customWordsInput.value = cleaned.join("\n");

    if (cleaned.length < 3) {
      alert(messages.customWordsMin);
      return;
    }
  }

  game = {
    players,
    impostors,
    totalRounds,
    currentRound: 1,
    roles: [],
    currentPlayer: 0,
  };

  startRound();
  saveGame();
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
    const theme = WORDS[themeSelect.value];
    words = theme && theme.words
      ? theme.words[currentLang] || theme.words.es || theme.words.en
      : [];
  }

  if (!words || words.length === 0) {
    alert(t("noWords"));
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
  updateRoleHeader();
  showScreen("role");
}

btnShowRole.onclick = () => {
  renderRoleText();
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
  updateRoundEndTitle();
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

applyTranslations();


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
