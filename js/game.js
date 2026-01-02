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
const btnRestartSame = document.getElementById("btn-restart-same");
const btnLang = document.getElementById("btn-lang");
const btnChangeModeOffline = document.getElementById("btn-change-mode-offline");
const btnChangeModeOnline = document.getElementById("btn-change-mode-online");
const modeOfflineBtn = document.getElementById("mode-offline");
const modeOnlineBtn = document.getElementById("mode-online");
const homeModeSelect = document.getElementById("home-mode-select");
const offlinePanel = document.getElementById("offline-panel");
const onlinePanel = document.getElementById("online-panel");
const homeIntro = document.getElementById("home-intro");
const onlineNameInput = document.getElementById("online-name");
const onlineCodeInput = document.getElementById("online-code");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const onlineLobby = document.getElementById("online-lobby");
const roomStatus = document.getElementById("room-status");
const playerList = document.getElementById("player-list");
const onlineSettings = document.getElementById("online-settings");
const onlineImpostorsInput = document.getElementById("online-impostors");
const onlineRoundsInput = document.getElementById("online-rounds");
const onlineHintModeInput = document.getElementById("online-hint-mode");
const onlineThemeSelect = document.getElementById("online-theme");
const onlineCustomWordsInput = document.getElementById("online-custom-words");
const onlineCustomWordsContainer = document.getElementById("online-custom-words-container");
const btnStartOnline = document.getElementById("btn-start-online");
const roomNote = document.getElementById("room-note");
const btnRestartOnline = document.getElementById("btn-restart-online");
const onlineHostControls = document.getElementById("online-host-controls");
const btnOnlineNextRound = document.getElementById("btn-online-next-round");
const btnOnlineEndGame = document.getElementById("btn-online-end-game");
const btnOnlineSelectImpostor = document.getElementById("btn-online-select-impostor");

const playersInput = document.getElementById("players");
const impostorsInput = document.getElementById("impostors");
const roundsInput = document.getElementById("rounds");
const hintModeInput = document.getElementById("hint-mode");
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
const countdownLabel = document.getElementById("countdown-label");
const roundCountdown = document.getElementById("round-countdown");
const countdownNumber = document.getElementById("countdown-number");
const homeModeDescOffline = document.getElementById("home-mode-desc-offline");
const homeModeDescOnline = document.getElementById("home-mode-desc-online");
const impostorSelectionContainer = document.getElementById("impostor-selection-container");
const impostorSelectionLabel = document.getElementById("impostor-selection-label");
const impostorSelectionSelect = document.getElementById("impostor-selection");
const btnConfirmImpostor = document.getElementById("btn-confirm-impostor");
const impostorSelectionMessage = document.getElementById("impostor-selection-message");
const impostorSelectionWait = document.getElementById("impostor-selection-wait");

let WORDS = {};

let game = {};
let lastConfig = null;
let onlineMode = "offline";
let onlineConfigOpen = false;
let configHistoryActive = false;
let pendingHistoryCallback = null;
let suppressHistoryPush = false;
let gameHistoryActive = false;
let onlineSelectionActive = false;
let onlineSelectionRemaining = null;
let onlineDiscoveredImpostors = new Set();
let socket = null;
let roomState = null;
let countdownInterval = null;
let pendingAutoReconnect = false;

const ONLINE_NAME_KEY = "impostor-online-name";
const ONLINE_CODE_KEY = "impostor-online-code";

const LANG_KEY = "impostor-lang";
const SUPPORTED_LANGS = ["es", "en"];
const THEME_HINTS = {
  all: { es: "mezcla", en: "mixed" },
  food: { es: "comida", en: "food" },
  places: { es: "lugar", en: "place" },
  animals: { es: "animal", en: "animal" },
  movies_series: { es: "cine", en: "movie" },
  sports: { es: "deporte", en: "sport" },
  professions: { es: "oficio", en: "job" },
  everyday_objects: { es: "objeto", en: "object" },
  transport: { es: "transporte", en: "transport" },
  actions_verbs: { es: "acción", en: "action" },
  hobbies: { es: "ocio", en: "hobby" },
  footballers: { es: "futbolista", en: "footballer" },
};
const CUSTOM_HINTS = { es: "Personalizado", en: "Custom" };

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
  renderLobby();
  updateRoleConfirmButton();
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

function getRoundOffset(round, players) {
  if (!Number.isFinite(round) || !Number.isFinite(players) || players <= 0) {
    return 0;
  }
  const offset = (round - 1) % players;
  return offset < 0 ? offset + players : offset;
}

function getActivePlayerIndex(turnIndex) {
  if (!Number.isFinite(turnIndex) || !Number.isFinite(game.players) || game.players <= 0) {
    return null;
  }
  const offset = getRoundOffset(game.currentRound, game.players);
  return (turnIndex + offset) % game.players;
}

function getTurnIndexForPlayer(playerIndex, round, players) {
  if (!Number.isFinite(playerIndex) || !Number.isFinite(players) || players <= 0) {
    return playerIndex;
  }
  const offset = getRoundOffset(round, players);
  return (playerIndex - offset + players) % players;
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function getThemeHint(themeKey, lang) {
  const theme = WORDS && WORDS[themeKey];
  const hint = (theme && theme.hint) || THEME_HINTS[themeKey];
  if (!hint) {
    return "";
  }
  if (theme && !theme.hint) {
    theme.hint = hint;
  }
  return hint[lang] || hint.es || hint.en || "";
}

function generateHintWord(secretWord, themeKey, lang) {
  const normalized = normalizeWord(secretWord);
  if (!normalized) {
    return "";
  }
  if (themeKey === "custom") {
    return CUSTOM_HINTS[lang] || CUSTOM_HINTS.es || "";
  }
  const theme = WORDS && WORDS[themeKey];
  if (!theme || !theme.words) {
    return "";
  }
  if (!theme.hintMap) {
    theme.hintMap = {};
  }
  if (!theme.hintMap[lang]) {
    const words = theme.words[lang] || theme.words.es || theme.words.en || [];
    const hintValue = getThemeHint(themeKey, lang);
    const map = {};
    if (Array.isArray(words)) {
      words.forEach(word => {
        const key = normalizeWord(word);
        if (key && !map[key]) {
          map[key] = hintValue;
        }
      });
    }
    theme.hintMap[lang] = map;
  }
  return theme.hintMap[lang][normalized] || getThemeHint(themeKey, lang);
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

  const activeIndex = getActivePlayerIndex(game.currentPlayer);
  if (!Number.isFinite(activeIndex)) {
    return;
  }

  const rawName = game.playerNames && game.playerNames[activeIndex];
  const displayName = rawName ? rawName : "";

  if (displayName) {
    playerTitle.textContent = "";
    const nameEl = document.createElement("span");
    nameEl.className = "player-name";
    nameEl.textContent = displayName;
    const metaEl = document.createElement("span");
    metaEl.className = "player-meta";
    metaEl.textContent = formatText(t("playerTitle"), {
      num: activeIndex + 1,
      total: game.players,
    });
    playerTitle.appendChild(nameEl);
    playerTitle.appendChild(metaEl);
  } else {
    playerTitle.textContent = formatText(t("playerTitle"), {
      num: activeIndex + 1,
      total: game.players,
    });
  }
  roundIndicator.textContent = formatText(t("roundIndicator"), {
    current: game.currentRound,
    total: game.totalRounds,
  });
}

window.addEventListener("popstate", event => {
  if (pendingHistoryCallback) {
    configHistoryActive = false;
    const cb = pendingHistoryCallback;
    pendingHistoryCallback = null;
    cb();
    return;
  }
  if (onlineMode !== "online" && !screens.role.classList.contains("hidden")) {
    if (!confirm(t("leaveGameConfirmOffline"))) {
      pushGameHistory();
      return;
    }
    roleOverlay.classList.add("hidden");
    hideRoundCountdown();
    clearGame();
    setMode("offline");
    showScreen("end");
    return;
  }
  const state = event.state || {};
  if (state.screen === "config") {
    suppressHistoryPush = true;
    onlineConfigOpen = false;
    setMode("offline");
    showScreen("config");
    suppressHistoryPush = false;
    configHistoryActive = true;
    return;
  }
  if (state.screen === "online-config") {
    suppressHistoryPush = true;
    onlineConfigOpen = true;
    setMode("online");
    showScreen("start");
    renderLobby();
    suppressHistoryPush = false;
    configHistoryActive = true;
    return;
  }
  if (!configHistoryActive) {
    return;
  }
  configHistoryActive = false;
  if (!screens.config.classList.contains("hidden") || (getActiveScreenName() === "start" && onlineConfigOpen)) {
    onlineConfigOpen = false;
    showScreen("start");
    renderLobby();
  }
});

function updateRoundEndTitle() {
  const roundValue = Number.isFinite(game.currentRound)
    ? game.currentRound
    : (roomState && roomState.game && Number.isFinite(roomState.game.currentRound)
      ? roomState.game.currentRound
      : null);
  if (!Number.isFinite(roundValue)) {
    return;
  }
  const remaining = onlineMode === "online"
    ? getOnlineRemainingImpostors()
    : getOfflineRemainingImpostors();
  const titleKey = remaining === 0 ? "roundEndTitleCaught" : "roundEndTitle";
  roundTitle.textContent = formatText(t(titleKey), {
    round: roundValue,
  });
}

function getOfflineDiscoveredImpostors() {
  if (!Array.isArray(game.discoveredImpostors)) {
    game.discoveredImpostors = [];
  }
  return game.discoveredImpostors;
}

function getOfflineImpostorIndices() {
  if (!Array.isArray(game.roles)) {
    return [];
  }
  return game.roles.reduce((acc, role, index) => {
    if (role === "IMPOSTOR") {
      acc.push(index);
    }
    return acc;
  }, []);
}

function getOfflineRemainingImpostors() {
  const total = getOfflineImpostorIndices().length;
  const found = getOfflineDiscoveredImpostors().length;
  return Math.max(total - found, 0);
}

function getOnlineRemainingImpostors() {
  if (Number.isFinite(onlineSelectionRemaining)) {
    return onlineSelectionRemaining;
  }
  const gameState = roomState && roomState.game;
  if (gameState && Number.isFinite(gameState.impostors)) {
    return gameState.impostors;
  }
  return 0;
}

function getImpostorSelectionPlayers() {
  if (onlineMode === "online") {
    if (!roomState || !Array.isArray(roomState.players)) {
      return [];
    }
    return roomState.players.map((player, index) => {
      const rawName = player && player.name ? player.name.trim() : "";
      return {
        id: player.id,
        name: rawName || formatText(t("playerLabel"), { num: index + 1 }),
        index,
      };
    });
  }
  const total = Number.isFinite(game.players) ? game.players : 0;
  const names = Array.isArray(game.playerNames) ? game.playerNames : [];
  return Array.from({ length: total }, (_, index) => {
    const rawName = names[index] ? names[index].trim() : "";
    return {
      id: String(index),
      name: rawName || formatText(t("playerLabel"), { num: index + 1 }),
      index,
    };
  });
}

function renderImpostorSelectionOptions() {
  if (!impostorSelectionSelect) {
    return;
  }
  const players = getImpostorSelectionPlayers();
  impostorSelectionSelect.innerHTML = "";
  if (onlineMode === "online") {
    players.forEach(player => {
      if (onlineDiscoveredImpostors.has(player.id)) {
        return;
      }
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = player.name;
      impostorSelectionSelect.appendChild(option);
    });
  } else {
    const discovered = new Set(getOfflineDiscoveredImpostors());
    players.forEach(player => {
      if (discovered.has(player.index)) {
        return;
      }
      const option = document.createElement("option");
      option.value = String(player.index);
      option.textContent = player.name;
      impostorSelectionSelect.appendChild(option);
    });
  }
  if (btnConfirmImpostor) {
    btnConfirmImpostor.disabled = impostorSelectionSelect.options.length === 0;
  }
}

function setImpostorSelectionMessage(text) {
  if (!impostorSelectionMessage) {
    return;
  }
  impostorSelectionMessage.textContent = text;
  impostorSelectionMessage.classList.remove("hidden");
  if (impostorSelectionWait) {
    impostorSelectionWait.classList.add("hidden");
  }
}

function clearImpostorSelectionMessage() {
  if (!impostorSelectionMessage) {
    return;
  }
  impostorSelectionMessage.textContent = "";
  impostorSelectionMessage.classList.add("hidden");
}

function updateRoundEndActions() {
  if (!btnNextRound || !btnEndGame) {
    return;
  }
  const isOnline = onlineMode === "online";
  const remaining = isOnline ? getOnlineRemainingImpostors() : getOfflineRemainingImpostors();
  const canShowActions = remaining === 0;
  const isHost = !isOnline || isOnlineHost();
  let canAdvance = false;
  if (canShowActions && isHost) {
    if (isOnline) {
      const gameState = roomState && roomState.game;
      canAdvance = gameState
        && Number.isFinite(gameState.currentRound)
        && Number.isFinite(gameState.totalRounds)
        && gameState.currentRound < gameState.totalRounds;
    } else {
      canAdvance = Number.isFinite(game.currentRound)
        && Number.isFinite(game.totalRounds)
        && game.currentRound < game.totalRounds;
    }
  }
  btnNextRound.classList.toggle("hidden", !canShowActions || !isHost || !canAdvance);
  btnEndGame.classList.toggle("hidden", !canShowActions || !isHost);
}

function updateImpostorSelectionUI(keepMessage = false) {
  if (!impostorSelectionContainer) {
    return;
  }
  updateRoundEndTitle();
  if (!keepMessage) {
    clearImpostorSelectionMessage();
  }
  const isOnline = onlineMode === "online";
  const isHost = !isOnline || isOnlineHost();
  const remaining = isOnline ? getOnlineRemainingImpostors() : getOfflineRemainingImpostors();
  const selectionComplete = remaining === 0;
  if (impostorSelectionWait) {
    const hasMessage = impostorSelectionMessage && !impostorSelectionMessage.classList.contains("hidden");
    const showWait = isOnline && !isHost && !selectionComplete && !hasMessage;
    impostorSelectionWait.classList.toggle("hidden", !showWait);
  }
  const showSelectionControls = isHost && !selectionComplete;
  if (impostorSelectionLabel) {
    impostorSelectionLabel.classList.toggle("hidden", !showSelectionControls);
  }
  if (btnConfirmImpostor) {
    btnConfirmImpostor.classList.toggle("hidden", !showSelectionControls);
  }
  if (showSelectionControls) {
    renderImpostorSelectionOptions();
  }
  updateRoundEndActions();
}

function showImpostorSelectionScreen() {
  roleOverlay.classList.add("hidden");
  hideRoundCountdown();
  updateRoundEndTitle();
  showScreen("roundEnd");
  updateImpostorSelectionUI();
}

function resetOnlineSelectionState(gameState) {
  onlineSelectionActive = false;
  onlineSelectionRemaining = gameState && Number.isFinite(gameState.impostors)
    ? gameState.impostors
    : null;
  onlineDiscoveredImpostors = new Set();
}

function renderRoleText() {
  roleText.className = "";

  if (!game.roles || !Number.isFinite(game.currentPlayer)) {
    return;
  }

  const activeIndex = getActivePlayerIndex(game.currentPlayer);
  if (!Number.isFinite(activeIndex)) {
    return;
  }

  if (game.roles[activeIndex] === "IMPOSTOR") {
    roleText.textContent = "";
    const titleEl = document.createElement("span");
    titleEl.textContent = t("impostor");
    roleText.appendChild(titleEl);
    if (game.hintMode && game.hintWord) {
      const hintEl = document.createElement("span");
      hintEl.className = "impostor-hint";
      hintEl.textContent = formatText(t("impostorHint"), { hint: game.hintWord });
      roleText.appendChild(hintEl);
    }
    roleText.classList.add("role-impostor");
  } else {
    roleText.innerHTML = `${t("wordIs")} <span class="word-highlight">
      ${game.roles[activeIndex]}
    </span>`;
  }
}

function updateRoleConfirmButton() {
  if (!btnNextPlayer) {
    return;
  }
  const onlineActive = onlineMode === "online"
    && roomState
    && roomState.game
    && roomState.game.started
    && !roomState.game.finished;
  btnNextPlayer.textContent = onlineActive ? t("roleConfirm") : t("nextPlayer");
}

function showRoundCountdown(seconds, labelKey = "roundCountdown") {
  if (!roundCountdown || !countdownNumber) {
    return;
  }
  if (countdownLabel) {
    countdownLabel.textContent = t(labelKey);
  }
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 3;
  let remaining = total;
  roundCountdown.classList.remove("hidden");
  countdownNumber.textContent = remaining;
  roleOverlay.classList.add("hidden");
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdownInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }
    countdownNumber.textContent = remaining;
  }, 1000);
}

function hideRoundCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (roundCountdown) {
    roundCountdown.classList.add("hidden");
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

function setLanguageToggleEnabled(enabled) {
  if (!btnLang) {
    return;
  }
  btnLang.disabled = !enabled;
  btnLang.setAttribute("aria-disabled", (!enabled).toString());
}

function updateLanguageToggleState(screenName) {
  let enabled = screenName === "start" || screenName === "config" || screenName === "end";
  if (onlineMode === "online" && roomState && roomState.game && roomState.game.started && !roomState.game.finished) {
    enabled = false;
  }
  setLanguageToggleEnabled(enabled);
}

function getActiveScreenName() {
  const entry = Object.keys(screens).find(name => !screens[name].classList.contains("hidden"));
  return entry || "start";
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  updateLanguageToggleState(name);
  if (name === "start") {
    updateStartView();
  }
  if (name === "config") {
    pushConfigHistory();
    gameHistoryActive = false;
  }
  if (name === "end") {
    updateEndScreenButtons();
    gameHistoryActive = false;
  }
}

function saveGame() {
  localStorage.setItem("impostor-game", JSON.stringify(game));
}

function clearGame() {
  localStorage.removeItem("impostor-game");
  gameHistoryActive = false;
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
    buildAllThemes();
    populateThemes();
  })
  .catch(err => {
    console.error("Error cargando words.json", err);
  });

function buildAllThemes() {
  if (!WORDS || Object.keys(WORDS).length === 0) {
    return;
  }
  const themeKeys = Object.keys(WORDS).filter(key => key !== "all");
  const allWords = { es: [], en: [] };
  const seen = { es: new Set(), en: new Set() };
  themeKeys.forEach(key => {
    const theme = WORDS[key];
    if (!theme || !theme.words) {
      return;
    }
    ["es", "en"].forEach(lang => {
      const list = theme.words[lang] || theme.words.es || theme.words.en || [];
      if (!Array.isArray(list)) {
        return;
      }
      list.forEach(word => {
        const cleaned = typeof word === "string" ? word.trim() : String(word).trim();
        if (!cleaned || seen[lang].has(cleaned)) {
          return;
        }
        seen[lang].add(cleaned);
        allWords[lang].push(cleaned);
      });
    });
  });
  const labelEs = WORDS.all && WORDS.all.es ? WORDS.all.es : "🌐 Todos los temas";
  const labelEn = WORDS.all && WORDS.all.en ? WORDS.all.en : "🌐 All themes";
  WORDS.all = {
    es: labelEs,
    en: labelEn,
    words: allWords,
  };
}

function populateThemes() {
  if (!WORDS || Object.keys(WORDS).length === 0) {
    return;
  }
  buildAllThemes();

  const currentValue = themeSelect.value;
  themeSelect.innerHTML = "";

  const themeKeys = Object.keys(WORDS).filter(key => key !== "all");
  if (WORDS.all) {
    themeKeys.push("all");
  }

  themeKeys.forEach(key => {
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

  if (onlineThemeSelect) {
    const currentOnlineValue = onlineThemeSelect.value;
    onlineThemeSelect.innerHTML = "";
    themeKeys.forEach(key => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = WORDS[key][currentLang] || WORDS[key].es || WORDS[key].en || key;
      onlineThemeSelect.appendChild(option);
    });
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = t("customTheme");
    onlineThemeSelect.appendChild(customOption);

    if (currentOnlineValue && (currentOnlineValue === "custom" || WORDS[currentOnlineValue])) {
      onlineThemeSelect.value = currentOnlineValue;
    } else if (themeKeys.length > 0) {
      onlineThemeSelect.value = themeKeys[0];
    } else {
      onlineThemeSelect.value = "custom";
    }
    updateOnlineCustomWordsVisibility();
  }
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

function updateOnlineCustomWordsVisibility() {
  if (!onlineCustomWordsContainer || !onlineThemeSelect) {
    return;
  }
  const showCustom = onlineThemeSelect.value === "custom";
  onlineCustomWordsContainer.classList.toggle("hidden", !showCustom);
}

function storeOnlineIdentity(name, code) {
  if (name) {
    localStorage.setItem(ONLINE_NAME_KEY, name);
  }
  if (code) {
    localStorage.setItem(ONLINE_CODE_KEY, code);
  }
}

function loadOnlineIdentity() {
  const name = localStorage.getItem(ONLINE_NAME_KEY) || "";
  const code = (localStorage.getItem(ONLINE_CODE_KEY) || "").toUpperCase();
  return { name, code };
}

function clearOnlineIdentity() {
  localStorage.removeItem(ONLINE_NAME_KEY);
  localStorage.removeItem(ONLINE_CODE_KEY);
}

function isOnlineHost() {
  return onlineMode === "online" && socket && roomState && roomState.hostId === socket.id;
}

function updateOnlineHostControls() {
  if (!onlineHostControls) {
    return;
  }
  const gameState = roomState && roomState.game;
  const gameActive = gameState && gameState.started && !gameState.finished;
  const remaining = getOnlineRemainingImpostors();
  const selectionComplete = remaining === 0;
  onlineHostControls.classList.toggle("hidden", !isOnlineHost() || !gameActive);
  if (btnOnlineSelectImpostor) {
    btnOnlineSelectImpostor.classList.toggle(
      "hidden",
      !isOnlineHost() || !gameActive || selectionComplete || onlineSelectionActive
    );
  }
  if (btnOnlineNextRound) {
    btnOnlineNextRound.classList.add("hidden");
  }
  if (btnOnlineEndGame) {
    btnOnlineEndGame.classList.add("hidden");
  }
}

function updateEndScreenButtons() {
  if (!btnRestart || !btnRestartSame) {
    return;
  }
  if (onlineMode !== "online") {
    btnRestart.classList.remove("hidden");
    btnRestartSame.classList.remove("hidden");
    return;
  }
  const show = isOnlineHost();
  btnRestart.classList.toggle("hidden", !show);
  btnRestartSame.classList.toggle("hidden", !show);
}

function clearLobby() {
  if (!onlineLobby || !roomStatus || !playerList) {
    return;
  }
  roomStatus.textContent = "";
  playerList.innerHTML = "";
  onlineLobby.classList.add("hidden");
  if (btnStartOnline) {
    btnStartOnline.classList.add("hidden");
  }
  if (btnRestartOnline) {
    btnRestartOnline.classList.add("hidden");
  }
  if (onlineSettings) {
    onlineSettings.classList.add("hidden");
  }
  if (roomNote) {
    roomNote.textContent = "";
    roomNote.classList.add("hidden");
  }
}

function renderLobby() {
  if (!onlineLobby || !roomStatus || !playerList || !roomState) {
    return;
  }
  if (!Array.isArray(roomState.players)) {
    return;
  }
  const isHost = socket && roomState.hostId === socket.id;
  const gameStarted = roomState.game && roomState.game.started;
  const gameFinished = roomState.game && roomState.game.finished;
  roomStatus.textContent = formatText(t("roomLabel"), { code: roomState.code });
  playerList.innerHTML = "";
  roomState.players.forEach(player => {
    const li = document.createElement("li");
    const isHostPlayer = player.id === roomState.hostId;
    li.textContent = `${player.name}${isHostPlayer ? ` (${t("hostTag")})` : ""}`;
    if (isHostPlayer) {
      li.classList.add("host");
    }
    playerList.appendChild(li);
  });
  const canConfigure = isHost && !gameStarted;
  if (btnStartOnline) {
    btnStartOnline.classList.toggle("hidden", !canConfigure);
  }
  if (btnRestartOnline) {
    btnRestartOnline.classList.add("hidden");
  }
  if (onlineSettings) {
    onlineSettings.classList.toggle("hidden", !canConfigure);
  }
  if (roomNote) {
    if (gameFinished) {
      roomNote.textContent = t("gameEnded");
      roomNote.classList.remove("hidden");
    } else if (gameStarted) {
      roomNote.textContent = t("waitingForRole");
      roomNote.classList.remove("hidden");
    } else if (!isHost) {
      roomNote.textContent = t("waitingForHost");
      roomNote.classList.remove("hidden");
    } else {
      roomNote.textContent = "";
      roomNote.classList.add("hidden");
    }
  }
  onlineLobby.classList.remove("hidden");
  updateOnlineHostControls();
  updateLanguageToggleState(getActiveScreenName());
  updateRoleConfirmButton();
  updateOnlineCustomWordsVisibility();
  updateEndScreenButtons();
}

function resetOnlineState() {
  roomState = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  clearLobby();
  hideRoundCountdown();
  resetOnlineSelectionState(null);
  if (onlineHostControls) {
    onlineHostControls.classList.add("hidden");
  }
}

function setMode(mode) {
  onlineMode = mode;
  if (modeOfflineBtn) {
    modeOfflineBtn.classList.toggle("active", mode === "offline");
  }
  if (modeOnlineBtn) {
    modeOnlineBtn.classList.toggle("active", mode === "online");
  }
  if (mode === "offline") {
    onlineConfigOpen = false;
    resetOnlineState();
  }
  updateStartView();
}

function updateStartView() {
  const showOnlineConfig = onlineMode === "online" && onlineConfigOpen;
  if (showOnlineConfig) {
    pushConfigHistory();
  }
  if (onlinePanel) {
    onlinePanel.classList.toggle("hidden", !showOnlineConfig);
  }
  if (homeIntro) {
    homeIntro.classList.toggle("hidden", showOnlineConfig);
  }
  if (homeModeSelect) {
    homeModeSelect.classList.toggle("hidden", showOnlineConfig);
  }
  if (offlinePanel) {
    offlinePanel.classList.toggle("hidden", showOnlineConfig);
  }
  if (homeModeDescOffline) {
    const show = !showOnlineConfig && onlineMode === "offline";
    homeModeDescOffline.classList.toggle("hidden", !show);
  }
  if (homeModeDescOnline) {
    const show = !showOnlineConfig && onlineMode === "online";
    homeModeDescOnline.classList.toggle("hidden", !show);
  }
}

function pushConfigHistory() {
  if (suppressHistoryPush || configHistoryActive) {
    return;
  }
  const screen = onlineMode === "online" && onlineConfigOpen ? "online-config" : "config";
  history.pushState({ screen }, "");
  configHistoryActive = true;
}

function pushGameHistory() {
  if (suppressHistoryPush || gameHistoryActive) {
    return;
  }
  history.pushState({ screen: "game" }, "");
  gameHistoryActive = true;
}

function clearConfigHistory(callback) {
  if (!configHistoryActive) {
    if (typeof callback === "function") {
      callback();
    }
    return;
  }
  pendingHistoryCallback = typeof callback === "function" ? callback : null;
  history.back();
}

function attemptAutoReconnect() {
  const { name, code } = loadOnlineIdentity();
  if (!name || !code) {
    return;
  }
  if (!window.io) {
    if (window.__socketIoReady && !pendingAutoReconnect) {
      pendingAutoReconnect = true;
      window.__socketIoReady
        .then(() => {
          pendingAutoReconnect = false;
          attemptAutoReconnect();
        })
        .catch(() => {
          pendingAutoReconnect = false;
        });
    }
    return;
  }
  if (onlineNameInput) {
    onlineNameInput.value = name;
  }
  if (onlineCodeInput) {
    onlineCodeInput.value = code;
  }
  setMode("online");
  const sock = ensureSocket();
  if (!sock) {
    return;
  }
  sock.timeout(4000).emit("reconnect_room", { name, code }, (err, response) => {
    if (err || !response || !response.ok) {
      clearOnlineIdentity();
      clearLobby();
      return;
    }
    roomState = response.room;
    roleOverlay.classList.add("hidden");
    hideRoundCountdown();
    resetOnlineSelectionState(roomState.game);
    onlineConfigOpen = true;
    showScreen("start");
    renderLobby();
  });
}

function getSocketBaseUrl() {
  const { hostname, port } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalhost) {
    const portSegment = port ? `:${port}` : "";
    return `http://${hostname}${portSegment}`;
  }
  return "https://impostor-game-b7vg.onrender.com";
}

function ensureSocket() {
  if (!window.io) {
    if (window.__socketIoFailed) {
      alert(t("onlineUnavailable"));
    }
    return null;
  }
  if (socket) {
    return socket;
  }
  socket = window.io(getSocketBaseUrl());
  socket.on("connect", () => {
    renderLobby();
  });
  socket.on("room_update", payload => {
    roomState = payload;
    renderLobby();
  });
  socket.on("game_started", payload => {
    if (payload && payload.code && Array.isArray(payload.players)) {
      roomState = {
        code: payload.code,
        hostId: payload.hostId,
        players: payload.players,
        game: payload.game || null,
      };
      hideRoundCountdown();
      resetOnlineSelectionState(roomState.game);
      renderLobby();
    }
  });
  socket.on("game_start_countdown", payload => {
    if (onlineMode !== "online") {
      return;
    }
    const seconds = payload && Number.isFinite(payload.seconds) ? payload.seconds : 3;
    showRoundCountdown(seconds, "gameCountdown");
  });
  socket.on("round_countdown", payload => {
    if (onlineMode !== "online") {
      return;
    }
    const seconds = payload && Number.isFinite(payload.seconds) ? payload.seconds : 3;
    showRoundCountdown(seconds);
  });
  socket.on("round_started", payload => {
    if (!roomState) {
      return;
    }
    roomState = {
      code: payload.code || roomState.code,
      hostId: payload.hostId || roomState.hostId,
      players: payload.players || roomState.players,
      game: payload.game || roomState.game,
    };
    hideRoundCountdown();
    roleOverlay.classList.add("hidden");
    resetOnlineSelectionState(roomState.game);
    renderLobby();
  });
  socket.on("impostor_selection_started", payload => {
    if (onlineMode !== "online") {
      return;
    }
    const remaining = payload && Number.isFinite(payload.remaining)
      ? payload.remaining
      : getOnlineRemainingImpostors();
    onlineSelectionActive = true;
    onlineSelectionRemaining = remaining;
    showImpostorSelectionScreen();
  });
  socket.on("impostor_selection_result", payload => {
    if (!payload || onlineMode !== "online") {
      return;
    }
    if (screens.roundEnd.classList.contains("hidden")) {
      updateRoundEndTitle();
      showScreen("roundEnd");
    }
    const playerId = payload.playerId;
    const correct = Boolean(payload.correct);
    if (Number.isFinite(payload.remaining)) {
      onlineSelectionRemaining = payload.remaining;
    }
    if (Number.isFinite(onlineSelectionRemaining)) {
      onlineSelectionActive = onlineSelectionRemaining > 0;
    }
    if (correct && playerId) {
      onlineDiscoveredImpostors.add(playerId);
    }
    let playerName = payload.playerName || "";
    if (!playerName && roomState && Array.isArray(roomState.players)) {
      const match = roomState.players.find(player => player.id === playerId);
      if (match && match.name) {
        playerName = match.name;
      }
    }
    if (!playerName) {
      playerName = playerId || "";
    }
    if (onlineSelectionRemaining === 0) {
      setImpostorSelectionMessage(t("impostorAllFound"));
    } else if (correct) {
      setImpostorSelectionMessage(formatText(t("impostorGuessCorrect"), {
        name: playerName,
        remaining: onlineSelectionRemaining,
      }));
    } else {
      setImpostorSelectionMessage(formatText(t("impostorGuessWrong"), {
        name: playerName,
      }));
    }
    updateImpostorSelectionUI(true);
  });
  socket.on("game_restarted", payload => {
    if (payload && payload.code && Array.isArray(payload.players)) {
      roomState = {
        code: payload.code,
        hostId: payload.hostId,
        players: payload.players,
        game: payload.game || null,
      };
      hideRoundCountdown();
      roleOverlay.classList.add("hidden");
      resetOnlineSelectionState(roomState.game);
      renderLobby();
    }
  });
  socket.on("game_ended", payload => {
    if (payload && payload.code && Array.isArray(payload.players)) {
      roomState = {
        code: payload.code,
        hostId: payload.hostId,
        players: payload.players,
        game: payload.game || null,
      };
    }
    hideRoundCountdown();
    roleOverlay.classList.add("hidden");
    resetOnlineSelectionState(null);
    setMode("online");
    showScreen("end");
    renderLobby();
  });
  socket.on("private_role", payload => {
    if (!payload || !roomState || !Array.isArray(roomState.players)) {
      return;
    }
    hideRoundCountdown();
    const playerIndex = Number.isFinite(payload.playerIndex)
      ? payload.playerIndex
      : roomState.players.findIndex(player => player.id === socket.id);
    const safeIndex = playerIndex >= 0 ? playerIndex : 0;
    const players = roomState.players;
    const gameState = roomState.game || {};
    const roundValue = payload.round || gameState.currentRound || 1;
    const turnIndex = getTurnIndexForPlayer(safeIndex, roundValue, players.length);
    game = {
      players: players.length,
      impostors: payload.impostors || gameState.impostors || 1,
      totalRounds: payload.totalRounds || gameState.totalRounds || 1,
      currentRound: roundValue,
      roles: Array(players.length).fill(null),
      currentPlayer: turnIndex,
      playerNames: players.map(player => player.name),
      hintMode: Boolean(payload.hint),
      hintWord: payload.hint || "",
    };
    game.roles[safeIndex] = payload.role;
    showRoleScreen();
    updateOnlineHostControls();
  });
  socket.on("room_closed", () => {
    roomState = null;
    clearLobby();
    clearOnlineIdentity();
    hideRoundCountdown();
    resetOnlineSelectionState(null);
  });
  return socket;
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

if (modeOfflineBtn) {
  modeOfflineBtn.onclick = () => {
    setMode("offline");
  };
}

if (modeOnlineBtn) {
  modeOnlineBtn.onclick = () => {
    onlineConfigOpen = false;
    setMode("online");
  };
}

const handleChangeMode = () => {
  const goHome = () => {
    onlineConfigOpen = false;
    showScreen("start");
  };
  clearConfigHistory(goHome);
};

if (btnChangeModeOffline) {
  btnChangeModeOffline.onclick = handleChangeMode;
}

if (btnChangeModeOnline) {
  btnChangeModeOnline.onclick = handleChangeMode;
}

if (btnCreateRoom) {
  btnCreateRoom.onclick = () => {
    const name = onlineNameInput ? onlineNameInput.value.trim() : "";
    if (!name) {
      alert(t("nameRequired"));
      return;
    }

    const sock = ensureSocket();
    if (!sock) {
      return;
    }

    sock.timeout(4000).emit("create_room", { name }, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
        return;
      }
      roomState = response.room;
      if (onlineCodeInput) {
        onlineCodeInput.value = roomState.code;
      }
      storeOnlineIdentity(name, roomState.code);
      renderLobby();
    });
  };
}

if (btnJoinRoom) {
  btnJoinRoom.onclick = () => {
    const name = onlineNameInput ? onlineNameInput.value.trim() : "";
    if (!name) {
      alert(t("nameRequired"));
      return;
    }
    let code = onlineCodeInput ? onlineCodeInput.value.trim().toUpperCase() : "";
    code = code.replace(/[^A-Z0-9]/g, "");
    if (onlineCodeInput) {
      onlineCodeInput.value = code;
    }
    if (!code) {
      alert(t("codeRequired"));
      return;
    }

    const sock = ensureSocket();
    if (!sock) {
      return;
    }

    sock.timeout(4000).emit("join_room", { name, code }, (err, response) => {
      if (err || !response) {
        alert(t("onlineError"));
        return;
      }
      if (!response.ok) {
        if (response.error === "not_found") {
          alert(t("roomNotFound"));
        } else {
          alert(t("onlineError"));
        }
        return;
      }
      roomState = response.room;
      storeOnlineIdentity(name, code);
      renderLobby();
    });
  };
}

if (btnStartOnline) {
  btnStartOnline.onclick = () => {
    if (!roomState || !socket) {
      return;
    }
    if (roomState.hostId !== socket.id) {
      alert(t("notHost"));
      return;
    }
    const playersCount = Array.isArray(roomState.players) ? roomState.players.length : 0;
    const impostors = parseInt(onlineImpostorsInput ? onlineImpostorsInput.value : "", 10);
    const totalRounds = parseInt(onlineRoundsInput ? onlineRoundsInput.value : "", 10);
    const theme = onlineThemeSelect ? onlineThemeSelect.value : "";
    const hintMode = onlineHintModeInput ? onlineHintModeInput.checked : false;
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

    if (playersCount < 3) {
      alert(messages.playersMin);
      return;
    }
    if (!Number.isFinite(impostors) || impostors < 1) {
      alert(messages.impostorsMin);
      return;
    }
    if (impostors >= playersCount) {
      alert(messages.impostorsMax);
      return;
    }
    if (!Number.isFinite(totalRounds) || totalRounds < 1) {
      alert(messages.roundsMin);
      return;
    }
    if (!theme || (theme !== "custom" && !WORDS[theme])) {
      alert(t("onlineError"));
      return;
    }
    const isCustomTheme = theme === "custom";
    let customWords = [];
    if (isCustomTheme && onlineCustomWordsInput) {
      const seen = new Set();
      customWords = onlineCustomWordsInput.value
        .split("\n")
        .map(word => word.trim())
        .filter(word => {
          if (!word || seen.has(word)) {
            return false;
          }
          seen.add(word);
          return true;
        });
      onlineCustomWordsInput.value = customWords.join("\n");
    }
    if (isCustomTheme && customWords.length < 3) {
      alert(messages.customWordsMin);
      return;
    }

    socket.timeout(4000).emit(
      "start_game",
      {
        impostors,
        totalRounds,
        theme,
        lang: currentLang,
        customWords: isCustomTheme ? customWords : [],
        hintMode,
      },
      (err, response) => {
        if (err || !response || !response.ok) {
          if (response && response.error === "not_host") {
            alert(t("notHost"));
          } else {
            alert(t("onlineError"));
          }
        }
      }
    );
  };
}

if (btnOnlineNextRound) {
  btnOnlineNextRound.onclick = () => {
    if (!socket || !roomState) {
      return;
    }
    if (roomState.hostId !== socket.id) {
      alert(t("notHost"));
      return;
    }
    const gameState = roomState.game;
    if (!gameState || gameState.currentRound >= gameState.totalRounds) {
      return;
    }
    socket.timeout(4000).emit("next_round", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
  };
}

if (btnOnlineSelectImpostor) {
  btnOnlineSelectImpostor.onclick = () => {
    if (!socket || !roomState) {
      return;
    }
    if (roomState.hostId !== socket.id) {
      alert(t("notHost"));
      return;
    }
    if (onlineSelectionActive) {
      return;
    }
    socket.timeout(4000).emit("start_impostor_selection", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
  };
}

if (btnOnlineEndGame) {
  btnOnlineEndGame.onclick = () => {
    if (!socket || !roomState) {
      return;
    }
    if (roomState.hostId !== socket.id) {
      alert(t("notHost"));
      return;
    }
    if (!confirm(t("endGameConfirm"))) {
      return;
    }
    socket.timeout(4000).emit("end_game", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
  };
}

if (btnRestartOnline) {
  btnRestartOnline.onclick = () => {
    if (!socket || !roomState) {
      return;
    }
    if (roomState.hostId !== socket.id) {
      alert(t("notHost"));
      return;
    }
    socket.timeout(4000).emit("restart_game", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
  };
}

btnStart.onclick = () => {
  if (onlineMode === "online") {
    onlineConfigOpen = true;
    showScreen("start");
    renderLobby();
    return;
  }
  showScreen("config");
};

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

if (onlineThemeSelect) {
  onlineThemeSelect.onchange = () => {
    updateOnlineCustomWordsVisibility();
  };
}

btnConfigNext.onclick = () => {
  const players = parseInt(playersInput.value, 10);
  const impostors = parseInt(impostorsInput.value, 10);
  const totalRounds = parseInt(roundsInput.value, 10);
  const hintMode = hintModeInput ? hintModeInput.checked : false;
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

  const themeValue = themeSelect.value;
  const customWordsValue = themeValue === "custom" ? customWordsInput.value : "";
  const playerNames = [];
  if (playerNamesContainer) {
    const inputs = playerNamesContainer.querySelectorAll("input");
    for (let i = 0; i < players; i++) {
      const value = inputs[i] ? inputs[i].value.trim() : "";
      playerNames.push(value);
    }
  }

  lastConfig = {
    players,
    impostors,
    totalRounds,
    theme: themeValue,
    playerNames,
    customWords: customWordsValue,
    hintMode,
  };

  game = {
    players,
    impostors,
    totalRounds,
    currentRound: 1,
    roles: [],
    currentPlayer: 0,
    playerNames,
    theme: themeValue,
    customWords: customWordsValue,
    hintMode,
    hintWord: "",
  };

  startRound();
  saveGame();
};


function startRound() {
  game.currentPlayer = 0;
  game.discoveredImpostors = [];

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
  game.hintWord = game.hintMode ? generateHintWord(word, game.theme, currentLang) : "";
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
  if (configHistoryActive) {
    clearConfigHistory(showRoleScreen);
    return;
  }
  updateRoleHeader();
  showScreen("role");
  if (onlineMode !== "online") {
    pushGameHistory();
  }
  updateOnlineHostControls();
  updateRoleConfirmButton();
}

function triggerPlayerTransition() {
  const roleScreen = screens.role;
  if (!roleScreen) {
    return;
  }
  roleScreen.classList.remove("player-transition");
  void roleScreen.offsetWidth;
  roleScreen.classList.add("player-transition");
}

btnShowRole.onclick = () => {
  updateRoleConfirmButton();
  renderRoleText();
  roleOverlay.classList.remove("hidden");
  triggerFeedback("reveal");
};

btnNextPlayer.onclick = () => {
  if (onlineMode === "online" && roomState && roomState.game && roomState.game.started) {
    roleOverlay.classList.add("hidden");
    return;
  }
  roleOverlay.classList.add("hidden");
  game.currentPlayer++;
  saveGame();

  if (game.currentPlayer >= game.players) {
    triggerFeedback("roundEnd");
    showEndOfRound();
  } else {
    triggerFeedback("next");
    showRoleScreen();
    triggerPlayerTransition();
  }
};

if (btnConfirmImpostor) {
  btnConfirmImpostor.onclick = () => {
    if (onlineMode === "online") {
      if (!socket || !roomState) {
        return;
      }
      if (!isOnlineHost()) {
        return;
      }
      const playerId = impostorSelectionSelect ? impostorSelectionSelect.value : "";
      if (!playerId) {
        return;
      }
      socket.timeout(4000).emit(
        "submit_impostor_selection",
        { playerId },
        (err, response) => {
          if (err || !response || !response.ok) {
            alert(t("onlineError"));
          }
        }
      );
      return;
    }
    if (!impostorSelectionSelect) {
      return;
    }
    const selectedIndex = parseInt(impostorSelectionSelect.value, 10);
    if (!Number.isFinite(selectedIndex)) {
      return;
    }
    const discovered = getOfflineDiscoveredImpostors();
    const isImpostor = Array.isArray(game.roles)
      && game.roles[selectedIndex] === "IMPOSTOR";
    if (isImpostor && !discovered.includes(selectedIndex)) {
      discovered.push(selectedIndex);
      game.discoveredImpostors = discovered;
      saveGame();
      const remaining = getOfflineRemainingImpostors();
      if (remaining === 0) {
        setImpostorSelectionMessage(t("impostorAllFound"));
      } else {
        const players = getImpostorSelectionPlayers();
        const name = players[selectedIndex] ? players[selectedIndex].name : formatText(t("playerLabel"), { num: selectedIndex + 1 });
        setImpostorSelectionMessage(formatText(t("impostorGuessCorrect"), {
          name,
          remaining,
        }));
      }
    } else {
      const players = getImpostorSelectionPlayers();
      const name = players[selectedIndex] ? players[selectedIndex].name : formatText(t("playerLabel"), { num: selectedIndex + 1 });
      setImpostorSelectionMessage(formatText(t("impostorGuessWrong"), { name }));
    }
    updateImpostorSelectionUI(true);
  };
}

function showEndOfRound() {
  showImpostorSelectionScreen();
}

btnNextRound.onclick = () => {
  if (onlineMode === "online") {
    if (!socket || !roomState) {
      return;
    }
    if (!isOnlineHost()) {
      alert(t("notHost"));
      return;
    }
    const gameState = roomState.game;
    if (!gameState || gameState.currentRound >= gameState.totalRounds) {
      return;
    }
    socket.timeout(4000).emit("next_round", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
    return;
  }
  if (game.currentRound >= game.totalRounds) {
    return;
  }
  game.currentRound++;
  saveGame();
  startRound();
};

btnEndGame.onclick = () => {
  if (onlineMode === "online") {
    if (!socket || !roomState) {
      return;
    }
    if (!isOnlineHost()) {
      alert(t("notHost"));
      return;
    }
    if (!confirm(t("endGameConfirm"))) {
      return;
    }
    socket.timeout(4000).emit("end_game", {}, (err, response) => {
      if (err || !response || !response.ok) {
        alert(t("onlineError"));
      }
    });
    return;
  }
  if (!confirm(t("endGameConfirm"))) {
    return;
  }
  clearGame();
  showScreen("end");
};

btnRestart.onclick = () => {
  if (onlineMode === "online") {
    if (!isOnlineHost()) {
      alert(t("notHost"));
      return;
    }
    onlineConfigOpen = true;
    setMode("online");
    showScreen("start");
    renderLobby();
    return;
  }
  clearGame();
  setMode("offline");
  showScreen("config");
};

if (btnRestartSame) {
  btnRestartSame.onclick = () => {
    if (onlineMode === "online") {
      if (!socket || !roomState) {
        return;
      }
      if (roomState.hostId !== socket.id) {
        alert(t("notHost"));
        return;
      }
      socket.timeout(4000).emit("restart_game", {}, (err, response) => {
        if (err || !response || !response.ok) {
          alert(t("onlineError"));
        }
      });
      return;
    }
    if (!lastConfig) {
      return;
    }

    themeSelect.value = lastConfig.theme || themeSelect.value;
    if (lastConfig.theme === "custom") {
      customWordsInput.value = lastConfig.customWords || "";
    }
    if (hintModeInput) {
      hintModeInput.checked = Boolean(lastConfig.hintMode);
    }
    customWordsContainer.classList.toggle(
      "hidden",
      themeSelect.value !== "custom"
    );
    updateThemePreview();

    game = {
      players: lastConfig.players,
      impostors: lastConfig.impostors,
      totalRounds: lastConfig.totalRounds,
      currentRound: 1,
      roles: [],
      currentPlayer: 0,
      playerNames: Array.isArray(lastConfig.playerNames)
        ? lastConfig.playerNames.slice()
        : [],
      theme: lastConfig.theme,
      customWords: lastConfig.customWords,
      hintMode: Boolean(lastConfig.hintMode),
      hintWord: "",
    };

    startRound();
  };
}

applyTranslations();
syncPlayerNameInputs();
setMode("offline");
attemptAutoReconnect();

const savedGame = localStorage.getItem("impostor-game");

if (savedGame) {
  game = JSON.parse(savedGame);
  if (!Array.isArray(game.discoveredImpostors)) {
    game.discoveredImpostors = [];
  }
  if (typeof game.hintMode !== "boolean") {
    game.hintMode = false;
  }
  if (typeof game.hintWord !== "string") {
    game.hintWord = "";
  }
  if (!lastConfig && game.players && game.impostors && game.totalRounds) {
    lastConfig = {
      players: game.players,
      impostors: game.impostors,
      totalRounds: game.totalRounds,
      theme: game.theme,
      playerNames: Array.isArray(game.playerNames) ? game.playerNames : [],
      customWords: game.customWords || "",
      hintMode: Boolean(game.hintMode),
    };
  }

  if (game.currentPlayer < game.players) {
    showRoleScreen();
  } else if (game.currentRound <= game.totalRounds) {
    showEndOfRound();
  } else {
    showScreen("end");
  }
}
