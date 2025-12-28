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
const playerNamesContainer = document.getElementById("player-names");
const themePreview = document.getElementById("theme-preview");

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
  updatePlayerNamePlaceholders();
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
    !Number.isFinite(game.totalRounds) ||
    !Number.isFinite(game.players)
  ) {
    return;
  }

  const rawName = game.playerNames && game.playerNames[game.currentPlayer];
  const displayName = rawName ? rawName : "";

  if (displayName) {
    playerTitle.textContent = "";
    const nameEl = document.createElement("span");
    nameEl.className = "player-name";
    nameEl.textContent = displayName;
    const metaEl = document.createElement("span");
    metaEl.className = "player-meta";
    metaEl.textContent = formatText(t("playerTitle"), {
      num: game.currentPlayer + 1,
      total: game.players,
    });
    playerTitle.appendChild(nameEl);
    playerTitle.appendChild(metaEl);
  } else {
    playerTitle.textContent = formatText(t("playerTitle"), {
      num: game.currentPlayer + 1,
      total: game.players,
    });
  }
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

const feedbackAudio = {
  ctx: null,
};

function playTone(freq, duration, volume) {
  let ctx = feedbackAudio.ctx;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      feedbackAudio.ctx = ctx;
    } catch (err) {
      return;
    }
  }

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
  osc.start(now);
  osc.stop(now + duration / 1000 + 0.02);
}

function triggerHaptic(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function triggerFeedback(type) {
  if (type === "reveal") {
    playTone(660, 120, 0.03);
    triggerHaptic(80);
  } else if (type === "next") {
    playTone(520, 80, 0.025);
    triggerHaptic(50);
  } else if (type === "roundEnd") {
    playTone(740, 140, 0.035);
    triggerHaptic(90);
  }
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

  updateThemePreview();
}

function updateThemePreview() {
  if (!themePreview || !WORDS || Object.keys(WORDS).length === 0) {
    return;
  }

  if (themeSelect.value === "custom") {
    themePreview.classList.add("hidden");
    themePreview.textContent = "";
    return;
  }

  const theme = WORDS[themeSelect.value];
  const words = theme && theme.words
    ? theme.words[currentLang] || theme.words.es || theme.words.en
    : [];

  if (!words || words.length === 0) {
    themePreview.classList.add("hidden");
    themePreview.textContent = "";
    return;
  }

  const sample = words.slice(0, 3).join(", ");
  themePreview.textContent = `${t("previewLabel")} ${sample}`;
  themePreview.classList.remove("hidden");
}

function updatePlayerNamePlaceholders() {
  if (!playerNamesContainer) {
    return;
  }

  const inputs = playerNamesContainer.querySelectorAll("input");
  inputs.forEach((input, index) => {
    input.placeholder = formatText(t("playerLabel"), { num: index + 1 });
  });
}

function syncPlayerNameInputs() {
  if (!playerNamesContainer) {
    return;
  }

  const count = parseInt(playersInput.value, 10);
  const total = Number.isFinite(count) && count > 0 ? count : 0;
  const existing = Array.from(playerNamesContainer.querySelectorAll("input")).map(input => input.value);

  playerNamesContainer.innerHTML = "";

  for (let i = 0; i < total; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = existing[i] ? existing[i].trim() : "";
    input.placeholder = formatText(t("playerLabel"), { num: i + 1 });
    playerNamesContainer.appendChild(input);
  }
}

if (btnLang) {
  btnLang.onclick = () => {
    setLanguage(currentLang === "es" ? "en" : "es");
  };
}

btnStart.onclick = () => showScreen("config");

playersInput.oninput = () => {
  syncPlayerNameInputs();
};

themeSelect.onchange = () => {
  customWordsContainer.classList.toggle(
    "hidden",
    themeSelect.value !== "custom"
  );
  updateThemePreview();
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

  const playerNames = [];
  if (playerNamesContainer) {
    const inputs = playerNamesContainer.querySelectorAll("input");
    for (let i = 0; i < players; i++) {
      const value = inputs[i] ? inputs[i].value.trim() : "";
      playerNames.push(value);
    }
  }

  game = {
    players,
    impostors,
    totalRounds,
    currentRound: 1,
    roles: [],
    currentPlayer: 0,
    playerNames,
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
  triggerFeedback("reveal");
};

btnNextPlayer.onclick = () => {
  roleOverlay.classList.add("hidden");
  game.currentPlayer++;
  saveGame();

  if (game.currentPlayer >= game.players) {
    triggerFeedback("roundEnd");
    showEndOfRound();
  } else {
    triggerFeedback("next");
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
syncPlayerNameInputs();

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
