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
const modeOfflineBtn = document.getElementById("mode-offline");
const modeOnlineBtn = document.getElementById("mode-online");
const offlinePanel = document.getElementById("offline-panel");
const onlinePanel = document.getElementById("online-panel");
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
const onlineThemeSelect = document.getElementById("online-theme");
const onlineCustomWordsInput = document.getElementById("online-custom-words");
const onlineCustomWordsContainer = document.getElementById("online-custom-words-container");
const btnStartOnline = document.getElementById("btn-start-online");
const roomNote = document.getElementById("room-note");
const btnRestartOnline = document.getElementById("btn-restart-online");
const onlineHostControls = document.getElementById("online-host-controls");
const btnOnlineNextRound = document.getElementById("btn-online-next-round");
const btnOnlineEndGame = document.getElementById("btn-online-end-game");

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
const countdownLabel = document.getElementById("countdown-label");
const roundCountdown = document.getElementById("round-countdown");
const countdownNumber = document.getElementById("countdown-number");

let WORDS = {};

let game = {};
let lastConfig = null;
let onlineMode = "offline";
let socket = null;
let roomState = null;
let countdownInterval = null;
let pendingAutoReconnect = false;

const ONLINE_NAME_KEY = "impostor-online-name";
const ONLINE_CODE_KEY = "impostor-online-code";

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
  if (name === "end") {
    updateEndScreenButtons();
  }
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

  if (onlineThemeSelect) {
    const currentOnlineValue = onlineThemeSelect.value;
    onlineThemeSelect.innerHTML = "";
    const themeKeys = Object.keys(WORDS);
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
  const canAdvance = gameState
    && Number.isFinite(gameState.currentRound)
    && Number.isFinite(gameState.totalRounds)
    && gameState.currentRound < gameState.totalRounds;
  onlineHostControls.classList.toggle("hidden", !isOnlineHost() || !gameActive);
  if (btnOnlineNextRound) {
    btnOnlineNextRound.classList.toggle("hidden", !isOnlineHost() || !gameActive || !canAdvance);
  }
  if (btnOnlineEndGame) {
    btnOnlineEndGame.classList.toggle("hidden", !isOnlineHost() || !gameActive);
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
  if (offlinePanel) {
    offlinePanel.classList.toggle("hidden", mode === "online");
  }
  if (onlinePanel) {
    onlinePanel.classList.toggle("hidden", mode !== "online");
  }
  if (mode === "offline") {
    resetOnlineState();
  }
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
    renderLobby();
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
    game = {
      players: players.length,
      impostors: payload.impostors || gameState.impostors || 1,
      totalRounds: payload.totalRounds || gameState.totalRounds || 1,
      currentRound: payload.round || gameState.currentRound || 1,
      roles: Array(players.length).fill(null),
      currentPlayer: safeIndex,
      playerNames: players.map(player => player.name),
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
    setMode("online");
  };
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

if (onlineThemeSelect) {
  onlineThemeSelect.onchange = () => {
    updateOnlineCustomWordsVisibility();
  };
}

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

function showEndOfRound() {
  updateRoundEndTitle();
  btnNextRound.classList.toggle(
    "hidden",
    game.currentRound >= game.totalRounds
  );

  showScreen("roundEnd");
}

btnNextRound.onclick = () => {
  if (game.currentRound >= game.totalRounds) {
    return;
  }
  game.currentRound++;
  saveGame();
  startRound();
};

btnEndGame.onclick = () => {
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
    showScreen("start");
    setMode("online");
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
  if (!lastConfig && game.players && game.impostors && game.totalRounds) {
    lastConfig = {
      players: game.players,
      impostors: game.impostors,
      totalRounds: game.totalRounds,
      theme: game.theme,
      playerNames: Array.isArray(game.playerNames) ? game.playerNames : [],
      customWords: game.customWords || "",
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
