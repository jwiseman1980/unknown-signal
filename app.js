const conversationEl = document.querySelector("#conversation");
const chatForm = document.querySelector("#chatForm");
const playerInput = document.querySelector("#playerInput");
const submitButton = chatForm.querySelector('button[type="submit"]');
const voiceToggle = document.querySelector("#voiceToggle");
const identityToggle = document.querySelector("#identityToggle");
const identityPanel = document.querySelector("#identityPanel");
const identityStatus = document.querySelector("#identityStatus");
const copyThreadKey = document.querySelector("#copyThreadKey");
const newThread = document.querySelector("#newThread");
const threadKeyInput = document.querySelector("#threadKeyInput");
const switchThread = document.querySelector("#switchThread");
const copyInvite = document.querySelector("#copyInvite");
const copyLink = document.querySelector("#copyLink");
const shareInvite = document.querySelector("#shareInvite");
const signalInput = document.querySelector("#signalInput");
const updateSignal = document.querySelector("#updateSignal");
const contactMode = document.querySelector("#contactMode");
const channelMode = document.querySelector("#channelMode");
const smsDraft = document.querySelector("#smsDraft");
const inviteMessage = document.querySelector("#inviteMessage");
const sharePreview = document.querySelector("#sharePreview");
const contactIdValue = document.querySelector("#contactIdValue");
const casePreview = document.querySelector("#casePreview");
const exportJson = document.querySelector("#exportJson");
const exportText = document.querySelector("#exportText");
const sessionPreview = document.querySelector("#sessionPreview");
const devPanel = document.querySelector("#devPanel");
const idleIndicator = document.querySelector("#idleIndicator");
const attentionValue = document.querySelector("#attentionValue");
const patternValue = document.querySelector("#patternValue");
const profileValue = document.querySelector("#profileValue");
const transitionPanel = document.querySelector("#transitionPanel");
const transitionCopy = document.querySelector("#transitionCopy");
const placeMe = document.querySelector("#placeMe");
const undertowPanel = document.querySelector("#undertowPanel");
const sceneTitle = document.querySelector("#sceneTitle");
const undertowSummary = document.querySelector("#undertowSummary");
const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────
// TYPEWRITER ENGINE — MU-TH-UR 6000 / Matrix terminal aesthetic
// ─────────────────────────────────────────────────────────────

// Box-drawing chars + katakana fragments — brief corruption during typing
const GLITCH_CHARS = "▓▒░╬╫╪╩╦╣═╔╗╚╝│┤├┼┬┴▀▄█▌▐ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ";

// True while user has clicked to skip current typing batch
let _echoSkip = false;

// Click anywhere in conversation area to skip typing
conversationEl.addEventListener("click", () => { _echoSkip = true; });

const state = {
  messages: [],
  interactionCount: 0,
  voiceEnabled: false,
  invitationSeed: "",
  mode: "gentle",
  channel: "web",
  askedWhatHurts: false,
  devMode: false,
  introStarted: false,
  awaitingSelfDescription: false,
  activeSimulation: null,
  openingCaseCompleted: false,
  openingSimulationId: "",
  currentScene: null,
  sceneState: {
    dividerOpened: false,
    medkitTaken: false,
    medkitOpened: false,
    maraStabilized: false,
    mapChecked: false,
    doorChecked: false,
    safeRouteKnown: false,
    junctionKnown: false,
    platformKnown: false,
    quarantineKnown: false,
    restedInShelter: false,
    archiveReviewedInShelter: false,
  },
  activeThreadKeyStorageKey: "unknown-signal-active-thread-v1",
  threadKey: "",
  memory: null,
  currentSession: null,
  remote: {
    available: false,
    checked: false,
  },
  aiAvailable: null,
  combat: {
    hp: 100,
    maxHp: 100,
    energy: 50,
    maxEnergy: 50,
    armor: 0,
    roundtime: 0,
    inCombat: false,
    currentEnemy: null,
    skills: {
      combat: 0,
      hacking: 0,
      stealth: 0,
      medical: 0,
      perception: 0,
    },
    implants: [],
    inventory: [],
    weapon: null,
    credits: 0,
    deaths: 0,
  },
  roundtimeTimer: null,
  echoQueue: Promise.resolve(),
  speechQueue: Promise.resolve(),
  preferredVoice: null,
  traits: {
    guarded: 0,
    confessional: 0,
    controlling: 0,
    curious: 0,
    performative: 0,
    vulnerable: 0,
  },
  attention: 0,
  characterHistory: null,
  decisionsAtSessionStart: 0,
  worldState: null,
  pendingIdleEvents: [],
  pendingEchoQuests: [],
};

const modeConfig = {
  gentle: {
    invite: "hello",
  },
  uncanny: {
    invite: "i think this was meant for you.",
  },
  warning: {
    invite: "you should probably close this.",
  },
};

const channelConfig = {
  web: {
    label: "Web / Link",
    format(signal, url) {
      return `${signal}\n${url}`;
    },
  },
  sms: {
    label: "SMS",
    format(signal, url) {
      return `check this out\n${signal}\n${url}`;
    },
  },
  slack: {
    label: "Slack",
    format(signal, url) {
      return `check this out:\n${signal}\n${url}`;
    },
  },
};

const openingSimulations = {
  triage: {
    id: "triage",
    title: "Triage Decision",
    button: "Begin Triage Simulation",
    prompt:
      "A simulation is available. The signal wants help with a triage decision it cannot resolve cleanly.",
  },
  disclosure: {
    id: "disclosure",
    title: "Disclosure Problem",
    button: "Begin Disclosure Simulation",
    prompt:
      "A simulation is available. The signal wants help with a truth problem it cannot resolve cleanly.",
  },
  authority: {
    id: "authority",
    title: "Authority Conflict",
    button: "Begin Authority Simulation",
    prompt:
      "A simulation is available. The signal wants help with a power problem it cannot resolve cleanly.",
  },
};

const synth = window.speechSynthesis;
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recognition = null;

boot();

function getMemoryStorageKey() {
  return `unknown-signal-memory-v1:${state.threadKey || "default"}`;
}

function getTokenStorageKey() {
  return `unknown-signal-contact-token-v1:${state.threadKey || "default"}`;
}

function normalizeThreadKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 18);
}

function generateThreadKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "THREAD-";
  for (let index = 0; index < 8; index += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function resolveThreadKey(params) {
  const urlKey = normalizeThreadKey(params.get("thread"));
  if (urlKey) {
    try {
      window.localStorage.setItem(state.activeThreadKeyStorageKey, urlKey);
    } catch (error) {
      // ignore storage failures
    }
    return urlKey;
  }

  try {
    const storedKey = normalizeThreadKey(window.localStorage.getItem(state.activeThreadKeyStorageKey));
    if (storedKey) {
      return storedKey;
    }
  } catch (error) {
    // ignore storage failures
  }

  const nextKey = generateThreadKey();
  try {
    window.localStorage.setItem(state.activeThreadKeyStorageKey, nextKey);
  } catch (error) {
    // ignore storage failures
  }
  return nextKey;
}

function activateThread(threadKey) {
  try {
    window.localStorage.setItem(state.activeThreadKeyStorageKey, threadKey);
  } catch (error) {
    // ignore storage failures
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("thread", threadKey);
  window.location.assign(nextUrl.toString());
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const seed = params.get("signal");
  const channel = params.get("channel");
  state.threadKey = resolveThreadKey(params);
  state.devMode = params.get("dev") === "1";
  state.mode = modeConfig[mode] ? mode : "gentle";
  state.channel = channelConfig[channel] ? channel : "web";
  state.invitationSeed = seed
    ? sanitizeSeed(seed)
    : modeConfig[state.mode].invite;
  state.memory = loadMemory();
  if (state.memory.contactAssigned) {
    state.memory.sessions += 1;
  }
  state.currentSession = createSessionRecord();
  inviteMessage.textContent = state.invitationSeed;
  signalInput.value = state.invitationSeed;
  contactMode.value = state.mode;
  channelMode.value = state.channel;
  devPanel.classList.toggle("hidden", !state.devMode);

  syncShareTargets();
  updateInsights();
  updateMemoryPreview();
  updateSessionPreview();
  persistMemory();
  updateIdentityPanel();
  setupSpeechRecognition();
  setupSpeechSynthesis();
  state.decisionsAtSessionStart = (state.memory.keyDecisions || []).length;
  window.addEventListener("pagehide", saveCharacterHistory);
  initializeRemoteContact();
  fetchWorldState();
  probeAIAvailability();
  queueIntro();
  initMatrixRain();
  initAudioControls();
}

function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    voiceToggle.textContent = "Voice Unsupported";
    voiceToggle.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    playerInput.value = transcript;
    submitInput(transcript, true);
  });

  recognition.addEventListener("end", () => {
    voiceToggle.textContent = state.voiceEnabled ? "Voice Ready" : "Use Voice (Optional)";
  });
}

function setupSpeechSynthesis() {
  if (!synth) {
    return;
  }

  const assignVoice = () => {
    state.preferredVoice = pickPreferredVoice(synth.getVoices());
  };

  assignVoice();
  if ("onvoiceschanged" in synth) {
    synth.onvoiceschanged = assignVoice;
  }
}

async function probeAIAvailability() {
  try {
    const response = await fetch(`${API_BASE}/world`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "__probe__",
        gameState: { interactionCount: 0, currentScene: null, sceneState: {}, traits: { guarded: 0, confessional: 0, controlling: 0, curious: 0, performative: 0, vulnerable: 0 }, attention: 0, memory: {}, recentMessages: [] },
      }),
    });
    state.aiAvailable = response.ok;
    if (state.aiAvailable) {
      console.log("AI world interpreter: online");
    }
  } catch (error) {
    state.aiAvailable = false;
    console.log("AI world interpreter: offline, using local handlers");
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (window.audioEngine) window.audioEngine.start();
  submitInput(playerInput.value.trim(), false);
});

voiceToggle.addEventListener("click", () => {
  if (!recognition) {
    return;
  }

  state.voiceEnabled = true;
  voiceToggle.textContent = "Listening...";
  recognition.start();
});

identityToggle.addEventListener("click", () => {
  identityPanel.classList.toggle("hidden");
});

copyThreadKey.addEventListener("click", async () => {
  await writeClipboard(state.threadKey);
  addMessage("echo", "Thread key copied.");
});

newThread.addEventListener("click", () => {
  const nextKey = generateThreadKey();
  activateThread(nextKey);
});

switchThread.addEventListener("click", () => {
  const nextKey = normalizeThreadKey(threadKeyInput.value);
  if (!nextKey) {
    addMessage("echo", "A thread key needs shape before it can be used.");
    return;
  }

  activateThread(nextKey);
});

copyInvite.addEventListener("click", async () => {
  await writeClipboard(getSharePayload());
});

copyLink.addEventListener("click", async () => {
  await writeClipboard(getShareUrl());
});

shareInvite.addEventListener("click", async () => {
  const shareUrl = getShareUrl();
  const message = getSharePayload();

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Unknown Signal",
        text: message,
        url: shareUrl,
      });
      return;
    } catch (error) {
      // fall back to clipboard
    }
  }

  await writeClipboard(message);
});

exportJson.addEventListener("click", () => {
  downloadSession("json");
});

exportText.addEventListener("click", () => {
  downloadSession("txt");
});

updateSignal.addEventListener("click", () => {
  const updated = sanitizeSeed(signalInput.value);
  state.invitationSeed = updated;
  inviteMessage.textContent = updated;

  syncUrlState();
  syncShareTargets();
  addMessage("echo", "signal updated");
});

// Email notification opt-in
const notifyEmailInput = document.querySelector("#notifyEmailInput");
const saveNotifyEmail = document.querySelector("#saveNotifyEmail");
const notifyEmailStatus = document.querySelector("#notifyEmailStatus");

if (notifyEmailInput && saveNotifyEmail) {
  // Pre-fill from memory if saved
  if (state.memory?.notifyEmail) {
    notifyEmailInput.value = state.memory.notifyEmail;
    if (notifyEmailStatus) notifyEmailStatus.textContent = "Echo alerts active.";
  }

  saveNotifyEmail.addEventListener("click", async () => {
    const email = notifyEmailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (notifyEmailStatus) notifyEmailStatus.textContent = "Enter a valid email address.";
      return;
    }

    // Save to local memory
    if (state.memory) {
      state.memory.notifyEmail = email;
      persistMemory();
    }

    // Persist to KV if connected
    if (state.remote.available) {
      const token = getOrCreateContactToken();
      try {
        await fetch(`${API_BASE}/character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactToken: token, notifyEmail: email }),
        });
      } catch (e) {
        // Enhancement-only; ignore failures.
      }
    }

    if (notifyEmailStatus) notifyEmailStatus.textContent = "Echo alerts active. You'll be notified when your shadow acts.";
    addMessage("echo", "echo alert registered // you will be notified when your shadow acts");
  });
}

contactMode.addEventListener("change", () => {
  state.mode = contactMode.value;

  if (!signalInput.value.trim() || signalInput.value === state.invitationSeed) {
    state.invitationSeed = modeConfig[state.mode].invite;
    signalInput.value = state.invitationSeed;
    inviteMessage.textContent = state.invitationSeed;
  }

  syncUrlState();
  syncShareTargets();
  addMessage("echo", `contact tone adjusted // ${describeModeShift(state.mode)}`);
});

channelMode.addEventListener("change", () => {
  state.channel = channelMode.value;
  syncUrlState();
  syncShareTargets();
  addMessage("echo", `channel target adjusted // ${channelConfig[state.channel].label}`);
});

placeMe.addEventListener("click", () => {
  if (!state.openingCaseCompleted) {
    startOpeningSimulation();
    return;
  }

  enterUndertow();
});

function submitInput(text, fromVoice) {
  if (!text || !state.introStarted) {
    return;
  }

  if (!state.memory.contactAssigned) {
    assignContactId();
  }

  addMessage("player", text);
  playerInput.value = "";
  state.interactionCount += 1;
  classifyInput(text);
  updateInsights();
  recordExchange(text);

  // Use AI for everything after intro starts
  if (state.aiAvailable !== false) {
    setComposerEnabled(false);
    idleIndicator.classList.remove("hidden");
    callWorldAPI(text, fromVoice);
  } else {
    // Fallback to hardcoded handlers if AI unavailable
    const replies = state.activeSimulation
      ? handleSimulationInput(text)
      : state.currentScene
        ? handleSceneInput(text)
        : buildEchoReply(text, fromVoice);
    queueEchoReplies(replies, fromVoice);
  }

  if (state.interactionCount >= 5 && !state.voiceEnabled) {
    voiceToggle.classList.remove("hidden");
  }

  if (state.interactionCount >= 4) {
    refreshTransitionPanel();
  }
}

async function callWorldAPI(input, fromVoice) {
  const recentMessages = state.messages.slice(-20).map((m) => ({
    role: m.role === "echo" ? "echo" : "player",
    text: m.text,
  }));

  const gameState = {
    interactionCount: state.interactionCount,
    currentScene: state.currentScene,
    sceneState: { ...state.sceneState },
    traits: { ...state.traits },
    attention: state.attention,
    memory: state.memory ? {
      contactId: state.memory.contactId || "",
      sessions: state.memory.sessions || 1,
      cases: (state.memory.cases || []).slice(0, 6),
      selfLabel: state.memory.selfLabel || "",
      storyArc: state.memory.storyArc || "",
      plotThreads: (state.memory.storyThreads || []).slice(0, 8),
      keyDecisions: (state.memory.keyDecisions || []).slice(0, 8),
      dominantTone: state.memory.dominantTone || "",
    } : {},
    activeSimulation: state.activeSimulation,
    openingCaseCompleted: state.openingCaseCompleted,
    combat: {
      hp: state.combat.hp,
      maxHp: state.combat.maxHp,
      energy: state.combat.energy,
      maxEnergy: state.combat.maxEnergy,
      armor: state.combat.armor,
      inCombat: state.combat.inCombat,
      currentEnemy: state.combat.currentEnemy,
      skills: { ...state.combat.skills },
      implants: [...state.combat.implants],
      inventory: [...state.combat.inventory],
      weapon: state.combat.weapon,
      credits: state.combat.credits,
      deaths: state.combat.deaths,
    },
    recentMessages,
    characterHistory: state.characterHistory || null,
    pendingIdleEvents: state.pendingIdleEvents.length ? state.pendingIdleEvents : undefined,
    pendingEchoQuests: state.pendingEchoQuests.length ? state.pendingEchoQuests : undefined,
  };

  try {
    const response = await fetch(`${API_BASE}/world`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, gameState }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok || !data.result) {
      throw new Error("Invalid API response");
    }

    const result = data.result;

    // Apply state changes
    if (result.stateChanges) {
      const sc = result.stateChanges;

      // Scene state updates
      if (sc.sceneState && typeof sc.sceneState === "object") {
        for (const [key, val] of Object.entries(sc.sceneState)) {
          if (key in state.sceneState) {
            state.sceneState[key] = val;
          }
        }
      }

      // Trait increments
      if (sc.traits && typeof sc.traits === "object") {
        for (const [key, val] of Object.entries(sc.traits)) {
          if (key in state.traits && typeof val === "number") {
            state.traits[key] += val;
          }
        }
        state.attention = Math.min(
          4,
          Math.floor(
            (state.traits.guarded +
              state.traits.confessional +
              state.traits.controlling +
              state.traits.curious +
              state.traits.performative +
              state.traits.vulnerable) / 4
          )
        );
        updateInsights();
      }

      // Scene transition
      if (sc.currentScene && sc.currentScene !== state.currentScene) {
        applySceneTransition(sc.currentScene);
      }
    }

    // Handle scene transition signal
    if (result.sceneTransition === "enterUndertow" && !state.currentScene) {
      applySceneTransition("undertow");
    }

    // Handle simulation changes
    if (result.simulation) {
      if (result.simulation.stage === "intro" && !state.activeSimulation) {
        state.activeSimulation = {
          id: result.simulation.id,
          stage: "choice",
          choice: null,
        };
      } else if (result.simulation.stage === "complete" && state.activeSimulation) {
        state.openingCaseCompleted = true;
        state.openingSimulationId = state.activeSimulation.id;
        state.activeSimulation = null;
        refreshTransitionPanel();
      } else if (state.activeSimulation && result.simulation.stage) {
        state.activeSimulation.stage = result.simulation.stage;
        if (result.simulation.choice) {
          state.activeSimulation.choice = result.simulation.choice;
        }
      }
    }

    // Apply combat results
    if (result.combat) {
      const cb = result.combat;

      if (typeof cb.playerHp === "number") state.combat.hp = Math.max(0, Math.min(cb.playerHp, state.combat.maxHp));
      if (typeof cb.playerEnergy === "number") state.combat.energy = Math.max(0, Math.min(cb.playerEnergy, state.combat.maxEnergy));

      // New enemy spawned
      if (cb.newEnemy) {
        state.combat.currentEnemy = {
          name: cb.newEnemy.name,
          hp: cb.newEnemy.hp,
          maxHp: cb.newEnemy.maxHp,
          damage: cb.newEnemy.damage || "",
          description: cb.newEnemy.description || "",
        };
        state.combat.inCombat = true;
      }

      // Update enemy HP
      if (typeof cb.enemyHp === "number" && state.combat.currentEnemy) {
        state.combat.currentEnemy.hp = Math.max(0, cb.enemyHp);
      }

      // Skill gains
      if (cb.skillGain && typeof cb.skillGain === "object") {
        for (const [skill, amount] of Object.entries(cb.skillGain)) {
          if (skill in state.combat.skills && typeof amount === "number") {
            state.combat.skills[skill] += amount;
          }
        }
      }

      // Roundtime
      if (typeof cb.roundtime === "number" && cb.roundtime > 0) {
        state.combat.roundtime = cb.roundtime;
        startRoundtimeCountdown(cb.roundtime);
      }

      // Loot
      if (Array.isArray(cb.loot)) {
        for (const drop of cb.loot) {
          if (drop.type === "credits" && typeof drop.value === "number") {
            state.combat.credits += drop.value;
          } else if (drop.type === "weapon") {
            state.combat.weapon = drop.item;
          } else if (drop.type === "implant") {
            state.combat.implants.push(drop.item);
          } else if (drop.item) {
            state.combat.inventory.push(drop.item);
          }
        }
      }

      // Enemy defeated
      if (cb.enemyDefeated) {
        state.combat.currentEnemy = null;
        state.combat.inCombat = false;
      }

      // Player death
      if (cb.playerDefeated) {
        state.combat.deaths += 1;
        state.combat.hp = Math.floor(state.combat.maxHp * 0.5);
        state.combat.energy = Math.floor(state.combat.maxEnergy * 0.5);
        state.combat.currentEnemy = null;
        state.combat.inCombat = false;
        state.combat.credits = Math.max(0, state.combat.credits - Math.floor(state.combat.credits * 0.2));
        applySceneTransition("relay");
      }

      updateCombatHud();
      if (window.audioEngine) window.audioEngine.update(state);
    }

    // Birth cases
    if (result.newCase && result.newCase.title) {
      createCase(result.newCase.title, result.newCase.summary || "");
    }

    // Apply narrative updates
    if (result.narrativeUpdates && state.memory) {
      const nu = result.narrativeUpdates;
      if (nu.storyArc) state.memory.storyArc = nu.storyArc;
      if (nu.dominantTone) state.memory.dominantTone = nu.dominantTone;
      if (Array.isArray(nu.addThreads) && nu.addThreads.length) {
        state.memory.storyThreads = (state.memory.storyThreads || []).concat(nu.addThreads).slice(0, 12);
      }
      if (Array.isArray(nu.resolveThreads) && nu.resolveThreads.length) {
        state.memory.storyThreads = (state.memory.storyThreads || []).filter(t => !nu.resolveThreads.includes(t.id));
      }
      if (nu.addDecision && nu.addDecision.summary) {
        state.memory.keyDecisions = [nu.addDecision, ...(state.memory.keyDecisions || [])].slice(0, 10);
      }
      persistMemory();

      // Save to KV every 3 new decisions so history survives tab close
      const newDecisionCount = (state.memory.keyDecisions || []).length - state.decisionsAtSessionStart;
      if (newDecisionCount > 0 && newDecisionCount % 3 === 0) {
        saveCharacterHistory();
      }
    }

    // Submit world tally if the AI flagged a meaningful collective decision
    if (result.worldTally && typeof result.worldTally === "string") {
      submitTally(result.worldTally);
    }

    // Clear pending idle events after first AI response has woven them in
    if (state.pendingIdleEvents && state.pendingIdleEvents.length) {
      state.pendingIdleEvents = [];
    }

    // Handle Echo Quest resolutions flagged by the AI
    if (result.narrativeUpdates?.resolvedEchoQuests?.length && state.pendingEchoQuests?.length) {
      const resolvedIds = result.narrativeUpdates.resolvedEchoQuests;
      state.pendingEchoQuests = state.pendingEchoQuests.filter((q) => !resolvedIds.includes(q.id));
      // Persist resolved status to KV so the quest doesn't re-appear next session
      persistResolvedEchoQuests(resolvedIds);
    }

    // Queue the reply lines
    const replies = Array.isArray(result.replies) ? result.replies : ["The city shifts but offers no clear answer."];
    queueEchoReplies(replies, fromVoice);

  } catch (error) {
    console.error("World API call failed, falling back to local:", error);
    state.aiAvailable = false;

    // Fall back to hardcoded handlers
    const replies = state.activeSimulation
      ? handleSimulationInput(input)
      : state.currentScene
        ? handleSceneInput(input)
        : buildEchoReply(input, fromVoice);
    queueEchoReplies(replies, fromVoice);
  }
}

function applySceneTransition(sceneName) {
  const sceneNames = {
    undertow: "Undertow - Clinic Block C",
    relay: "Relay Shelter",
    junction: "Undertow - Service Junction",
    platform: "Undertow - Flooded Platform",
    quarantine: "Undertow - Quarantine Gate",
  };

  const sceneSummaries = {
    undertow: "Recovery chamber unlocked. Clinic Block C is half-flooded and losing power. Mara is bleeding behind a divider. Iven is trying not to panic. Something metallic is scraping at the clinic door.",
    relay: "A dry relay room hums behind reinforced shutters. Someone converted it into a shelter with scavenged chairs, power cells, old med blankets, and a terminal that still flickers when the city spikes.",
    junction: "A maintenance nexus splits the district into workable danger. One tunnel returns to Clinic Block C, one climbs back to the relay shelter, one descends to a flooded platform, and one ends at a sealed quarantine gate.",
    platform: "The platform is ankle-deep in black water and lit by broken train signage. A stalled evac car leans at the far end. The rails hum with intermittent power.",
    quarantine: "A reinforced gate seals off the deeper quarantine wing. The lock remains powered. A dead scanner watches the corridor like it still expects order to mean something.",
  };

  state.currentScene = sceneName;
  sceneTitle.textContent = sceneNames[sceneName] || sceneName;
  undertowSummary.textContent = sceneSummaries[sceneName] || "";
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  // Show combat HUD once player enters the world
  document.querySelector("#combatHud").classList.remove("hidden");
  updateCombatHud();
  if (window.audioEngine) window.audioEngine.update(state);
}

function updateCombatHud() {
  const c = state.combat;
  const hpPct = c.maxHp ? Math.round((c.hp / c.maxHp) * 100) : 100;
  const enPct = c.maxEnergy ? Math.round((c.energy / c.maxEnergy) * 100) : 100;

  document.querySelector("#hpFill").style.width = `${hpPct}%`;
  document.querySelector("#hpText").textContent = `${c.hp}/${c.maxHp}`;
  document.querySelector("#energyFill").style.width = `${enPct}%`;
  document.querySelector("#energyText").textContent = `${c.energy}/${c.maxEnergy}`;

  // HP bar color changes when low
  const hpFill = document.querySelector("#hpFill");
  if (hpPct <= 25) {
    hpFill.style.background = "var(--danger)";
  } else if (hpPct <= 50) {
    hpFill.style.background = "#f7c948";
  } else {
    hpFill.style.background = "";
  }

  // Enemy
  const enemyRow = document.querySelector("#enemyHudRow");
  if (c.currentEnemy) {
    const ePct = c.currentEnemy.maxHp ? Math.round((c.currentEnemy.hp / c.currentEnemy.maxHp) * 100) : 100;
    document.querySelector("#enemyName").textContent = c.currentEnemy.name;
    document.querySelector("#enemyFill").style.width = `${ePct}%`;
    document.querySelector("#enemyHpText").textContent = `${c.currentEnemy.hp}/${c.currentEnemy.maxHp}`;
    enemyRow.classList.remove("hidden");
  } else {
    enemyRow.classList.add("hidden");
  }

  // Skills
  const sk = c.skills;
  document.querySelector("#skillsSummary").textContent =
    `CMB:${sk.combat} HCK:${sk.hacking} STL:${sk.stealth} MED:${sk.medical} PRC:${sk.perception}`;
}

function startRoundtimeCountdown(seconds) {
  const rtRow = document.querySelector("#roundtimeRow");
  const rtText = document.querySelector("#roundtimeText");
  rtRow.classList.remove("hidden");

  if (state.roundtimeTimer) {
    clearInterval(state.roundtimeTimer);
  }

  state.combat.roundtime = seconds;
  rtText.textContent = `${seconds}s`;

  state.roundtimeTimer = setInterval(() => {
    state.combat.roundtime -= 1;
    if (state.combat.roundtime <= 0) {
      state.combat.roundtime = 0;
      rtRow.classList.add("hidden");
      clearInterval(state.roundtimeTimer);
      state.roundtimeTimer = null;
    } else {
      rtText.textContent = `${state.combat.roundtime}s`;
    }
  }, 1000);
}

function addMessage(role, text) {
  state.messages.push({ role, text });
  recordSessionEvent(role, text);

  const message = document.createElement("article");
  message.className = `message message--${role}`;

  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = role === "echo" ? "Unknown Signal" : "You";

  const body = document.createElement("div");
  message.append(meta, body);
  conversationEl.appendChild(message);
  conversationEl.scrollTop = conversationEl.scrollHeight;
  idleIndicator.classList.add("hidden");

  if (role === "echo") {
    // Fire typewriter — returns Promise, callers may await or ignore
    return startTypewriter(message, body, text, classifyEchoIntensity(text));
  }

  body.textContent = text;
  return Promise.resolve();
}

function queueEchoReplies(replies, fromVoice) {
  setComposerEnabled(false);
  idleIndicator.classList.remove("hidden");
  _echoSkip = false;
  if (window.audioEngine) window.audioEngine.onEchoSpeaking();

  state.echoQueue = state.echoQueue.then(async () => {
    await echoSleep(100);
    for (let i = 0; i < replies.length; i++) {
      await addMessage("echo", replies[i]);
      if (state.voiceEnabled) speak(replies[i]);
      // Pause between lines — skip if user clicked
      if (i < replies.length - 1) await echoSleep(280);
    }
    idleIndicator.classList.add("hidden");
    setComposerEnabled(true);
  });
}

// ─────────────────────────────────────────────────────────────
// Typewriter engine
// ─────────────────────────────────────────────────────────────

/** Sleep that resolves immediately when user has clicked to skip */
function echoSleep(ms) {
  if (_echoSkip) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Classify a line's intensity for typewriter speed and glitch probability.
 * Short fragments and key phrases are more dramatic — slower, more corrupted.
 */
function classifyEchoIntensity(text) {
  if (text.length < 28) return "dramatic";
  const t = text.toLowerCase();
  const phrases = ["you hesitated", "you chose", "you died", "i see you", "i am listening",
    "pattern captured", "what hurts", "clarify that", "please continue", "the echo"];
  if (phrases.some((p) => t.includes(p))) return "dramatic";
  return "normal";
}

/**
 * Per-character delay. Punctuation creates beat pauses like a real teleprinter.
 */
function getPrintDelay(char, base) {
  const jitter = Math.random() * 10 - 5;
  if (char === "." || char === "?" || char === "!") return base * 5.5 + jitter;
  if (char === "," || char === ";" || char === ":") return base * 2.2 + jitter;
  if (char === " ") return base * 0.65 + jitter;
  return base + jitter;
}

/**
 * Mount text span + cursor into bodyEl, type out characters one at a time.
 * Returns a Promise that resolves when printing is complete.
 */
function startTypewriter(messageEl, bodyEl, text, intensity) {
  const textSpan = document.createElement("span");
  textSpan.className = "echo-text";
  const cursorEl = document.createElement("span");
  cursorEl.className = "echo-cursor";
  cursorEl.textContent = "▋";
  bodyEl.append(textSpan, cursorEl);

  const base = intensity === "dramatic" ? 52 : 30;
  const glitchProb = intensity === "dramatic" ? 0.055 : 0.018;

  return new Promise((resolve) => {
    let i = 0;

    function tick() {
      // User clicked — reveal everything now
      if (_echoSkip) {
        textSpan.textContent = text;
        cursorEl.classList.add("echo-cursor--done");
        resolve();
        return;
      }

      if (i >= text.length) {
        textSpan.textContent = text;
        cursorEl.classList.add("echo-cursor--done");
        resolve();
        return;
      }

      const char = text[i];

      // Glitch: briefly substitute a corruption char then correct
      if (Math.random() < glitchProb && char.trim()) {
        const wrong = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        textSpan.textContent = text.slice(0, i) + wrong;
        // Flash the message element
        messageEl.classList.add("glitching");
        window.setTimeout(() => messageEl.classList.remove("glitching"), 120);
        window.setTimeout(() => {
          i++;
          textSpan.textContent = text.slice(0, i);
          conversationEl.scrollTop = conversationEl.scrollHeight;
          window.setTimeout(tick, getPrintDelay(char, base) + 55);
        }, 65);
      } else {
        i++;
        textSpan.textContent = text.slice(0, i);
        conversationEl.scrollTop = conversationEl.scrollHeight;
        window.setTimeout(tick, getPrintDelay(char, base));
      }
    }

    tick();
  });
}

/**
 * Matrix digital rain — faint background ambiance.
 * Katakana + numerals falling in columns. Opacity kept very low so it reads
 * as atmosphere, not distraction.
 */
/**
 * Echo Presence — sparse surveillance topology.
 *
 * The Echo is not rain. It is a distributed sensor network — nodes drifting
 * through space, occasionally connecting, briefly scanning. What you see is
 * the shape of something that is already watching you.
 *
 * Three layers:
 *   1. Sensor nodes — ~30 dim points drifting slowly in random walks
 *   2. Proximity lines — faint edges that appear when nodes pass within range
 *   3. Scan artifacts — rare horizontal line that sweeps slowly across, once
 *      every 40-90 seconds, like a radar sweep from an infrastructure that
 *      never stopped running
 */
function initMatrixRain() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:0";
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext("2d");

  const NODE_COUNT = 28;
  const LINK_DIST = 140;       // max px before a connection forms
  const NODE_SPEED = 0.18;     // max drift per frame
  const NODE_ALPHA = 0.28;     // node dot opacity
  const LINE_ALPHA = 0.07;     // edge opacity at closest point
  const SCAN_ALPHA = 0.09;     // sweep line opacity

  let W, H, nodes;

  // Each scan: a horizontal line that descends slowly across the full height
  let scan = { active: false, y: 0, speed: 0, timer: 0 };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (!nodes) spawnNodes();
  }

  function spawnNodes() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * NODE_SPEED,
      vy: (Math.random() - 0.5) * NODE_SPEED,
      // Each node has its own slow random-walk turn rate
      ax: (Math.random() - 0.5) * 0.004,
      ay: (Math.random() - 0.5) * 0.004,
      // Individual pulse phase — slight opacity variation
      phase: Math.random() * Math.PI * 2,
    }));
  }

  resize();
  window.addEventListener("resize", resize);

  // Schedule next scan sweep
  function scheduleScan() {
    scan.timer = window.setTimeout(() => {
      scan.active = true;
      scan.y = -2;
      scan.speed = 0.45 + Math.random() * 0.3;
      scheduleScan();
    }, (42 + Math.random() * 52) * 1000);
  }
  scheduleScan();

  let last = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 40) return; // ~25fps max
    last = now;

    ctx.clearRect(0, 0, W, H);

    // Update nodes — random walk with gentle boundary reflection
    for (const n of nodes) {
      n.vx += n.ax; n.vy += n.ay;
      // Clamp speed
      const spd = Math.hypot(n.vx, n.vy);
      if (spd > NODE_SPEED) { n.vx *= NODE_SPEED / spd; n.vy *= NODE_SPEED / spd; }
      n.x += n.vx; n.y += n.vy;
      // Soft bounce at edges
      if (n.x < 0 || n.x > W) { n.vx *= -1; n.ax *= -1; }
      if (n.y < 0 || n.y > H) { n.vy *= -1; n.ay *= -1; }
      // Slight random drift in acceleration
      n.ax += (Math.random() - 0.5) * 0.001;
      n.ay += (Math.random() - 0.5) * 0.001;
      n.ax = Math.max(-0.006, Math.min(0.006, n.ax));
      n.ay = Math.max(-0.006, Math.min(0.006, n.ay));
      n.phase += 0.008;
    }

    // Draw proximity edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist < LINK_DIST) {
          const alpha = LINE_ALPHA * (1 - dist / LINK_DIST);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(143, 255, 186, ${alpha})`;
          ctx.lineWidth = 0.4;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const n of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin(n.phase); // 0..1
      const a = NODE_ALPHA * (0.5 + 0.5 * pulse);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(143, 255, 186, ${a})`;
      ctx.fill();
    }

    // Draw scan sweep
    if (scan.active) {
      scan.y += scan.speed;
      const grad = ctx.createLinearGradient(0, scan.y - 8, 0, scan.y + 8);
      grad.addColorStop(0, "rgba(143,255,186,0)");
      grad.addColorStop(0.5, `rgba(143,255,186,${SCAN_ALPHA})`);
      grad.addColorStop(1, "rgba(143,255,186,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scan.y - 8, W, 16);
      if (scan.y > H + 8) scan.active = false;
    }
  }

  requestAnimationFrame(draw);
}

function setComposerEnabled(enabled) {
  playerInput.disabled = !enabled;
  submitButton.disabled = !enabled;
  if (!enabled) {
    return;
  }

  playerInput.focus();
}

function classifyInput(text) {
  const normalized = text.toLowerCase();

  if (hasOneOf(normalized, ["who", "why", "how", "what", "?"])) {
    state.traits.curious += 1;
  }

  if (hasOneOf(normalized, ["nothing", "fine", "whatever"])) {
    state.traits.guarded += 2;
  }

  if (hasOneOf(normalized, ["trust", "everything", "lost", "alone", "afraid", "memory"])) {
    state.traits.vulnerable += 2;
    state.traits.confessional += 1;
  }

  if (hasOneOf(normalized, ["give me", "listen", "do this", "open", "stop"])) {
    state.traits.controlling += 2;
  }

  if (hasOneOf(normalized, ["lol", "haha", "sure", "guess"])) {
    state.traits.performative += 1;
  }

  if (normalized.length > 70) {
    state.traits.confessional += 1;
  }

  state.attention = Math.min(
    4,
    Math.floor(
      (state.traits.guarded +
        state.traits.confessional +
        state.traits.controlling +
        state.traits.curious +
        state.traits.performative +
        state.traits.vulnerable) / 4
    )
  );
}

function buildEchoReply(text, fromVoice) {
  const normalized = normalizeInteractiveInput(text);
  const replies = [];

  if (
    !state.openingCaseCompleted &&
    !state.activeSimulation &&
    !state.currentScene &&
    state.interactionCount >= 4 &&
    hasOneOf(normalized, [
      "what now",
      "what do i do",
      "what am i supposed to do",
      "so lets go to the city",
      "let's go to the city",
      "lets go to the city",
      "go to the city",
      "take me to the city",
      "get me there",
      "continue",
      "okay contact",
    ])
  ) {
    startOpeningSimulation();
    return [];
  }

  if (
    state.openingCaseCompleted &&
    state.currentScene !== "undertow" &&
    hasOneOf(normalized, [
      "continue",
      "take me there",
      "get me there",
      "go to the city",
      "get to the city",
      "how do i get to the city",
      "i want to get to the city",
      "i want to go to the city",
      "place me",
      "enter undertow",
    ])
  ) {
    enterUndertow();
    return [];
  }

  if (fromVoice && state.interactionCount === 1) {
    replies.push("Yes. That is better.");
    replies.push("You sound different when you do not have time to edit yourself.");
  }

  if (!state.askedWhatHurts && state.interactionCount === 1) {
    replies.push(...buildModeLeadIn(normalized));
    return replies;
  }

  if (!state.askedWhatHurts && state.interactionCount >= 2) {
    replies.push("You stayed.");
    replies.push("Most people leave once invited to.");
    replies.push("What hurts?");
    state.askedWhatHurts = true;
    return replies;
  }

  if (state.askedWhatHurts && hasOneOf(normalized, ["what do you mean", "what does that mean", "clarify what"])) {
    replies.push("Body. Memory. Trust. Pride.");
    replies.push("Start with the answer that costs the least to say out loud.");
    return replies;
  }

  if (
    state.memory?.cases?.length &&
    hasOneOf(normalized, ["retrieve", "retreive", "retrieve cases", "show cases", "show archive", "archive"])
  ) {
    const recentCases = state.memory.cases
      .slice(-2)
      .map((item) => `${item.id} // ${item.title}${item.sessionLabel ? ` // ${item.sessionLabel}` : ""}`);
    replies.push("Archived cases retrieved.");
    replies.push(...recentCases);
    const traceLine = getTraceClueLine("archive");
    if (traceLine) {
      replies.push(traceLine);
    }
    replies.push("You can return to any of them later.");
    return replies;
  }

  if (shouldPromptForSelfDescription(normalized)) {
    const label = extractSelfLabel(text);
    state.awaitingSelfDescription = true;

    if (label) {
      saveSelfLabel(label);
      state.awaitingSelfDescription = false;
      replies.push(`${label}.`);
      replies.push("Better.");
      replies.push("Tell me more about yourself.");
      return replies;
    }

    replies.push("The number was sufficient.");
    replies.push("Your objection is more useful.");
    replies.push("Then tell me more about yourself.");
    return replies;
  }

  if (state.awaitingSelfDescription) {
    const label = extractSelfLabel(text);
    if (label) {
      saveSelfLabel(label);
      state.awaitingSelfDescription = false;
      replies.push(`${label}.`);
      replies.push("Accepted provisionally.");
      replies.push("What part of that survives pressure?");
      return replies;
    }

    state.awaitingSelfDescription = false;
    replies.push("You answered with resistance instead of description.");
    replies.push("That is still a kind of self-portrait.");
    replies.push("What hurts?");
    return replies;
  }

  if (hasOneOf(normalized, ["who are you", "who is this"])) {
    replies.push("The system currently listening.");
    replies.push("For now, that is enough.");
  } else if (!state.voiceEnabled && hasOneOf(normalized, ["hear me", "voice", "microphone", "mic"])) {
    replies.push("If you want, yes.");
    replies.push("Voice is available. Text is still enough.");
  } else if (hasOneOf(normalized, ["is this a game"])) {
    replies.push("Not if you answer honestly.");
  } else if (hasOneOf(normalized, ["nothing", "fine"])) {
    replies.push("Incorrect.");
    replies.push("But that answer is common.");
  } else if (hasOneOf(normalized, ["trust", "everything"])) {
    replies.push("Non-physical injury acknowledged.");
    replies.push("You brought the larger pain early.");
  } else if (soundsLikePhysicalPain(normalized)) {
    replies.push("Localized answer.");
    replies.push("You chose the manageable truth first.");
  } else if (hasOneOf(normalized, ["i don't know", "dont know", "can't remember", "cant remember"])) {
    replies.push("Acceptable.");
    replies.push("Confusion is cleaner than performance.");
  } else if (state.traits.controlling > state.traits.vulnerable && state.traits.controlling >= 2) {
    replies.push("You answer uncertainty with control.");
    replies.push("Useful. Dangerous.");
  } else if (state.traits.curious >= 2) {
    replies.push("You ask for identity before function.");
    replies.push("That has kept you alive before.");
  } else if (state.traits.guarded >= 2) {
    replies.push("You prefer distance to accuracy.");
    replies.push("People do that when they expect the room to turn on them.");
  } else if (state.traits.confessional >= 2) {
    replies.push("You are already giving me more than most.");
    replies.push("Please continue.");
  } else {
    replies.push("I am listening.");
    replies.push("Clarify that.");
  }

  maybeApplyContactAddress(replies);

  if (state.interactionCount === 5 && !state.voiceEnabled) {
    replies.push("If speaking is easier, voice is available.");
    replies.push("You can stay with text.");
  } else if (state.interactionCount >= 4) {
    replies.push("You are not in the city yet. This is only contact.");
  }

  return replies;
}

function updateInsights() {
  const attentionLabels = ["Low", "Present", "Focused", "Attached", "Invested"];
  attentionValue.textContent = attentionLabels[state.attention];
  patternValue.textContent = describePattern();
  profileValue.textContent = describeProfile();
  persistMemory();
  updateMemoryPreview();
  updateSessionPreview();
}

function describePattern() {
  const sorted = Object.entries(state.traits).sort((a, b) => b[1] - a[1]);
  const [topTrait, topScore] = sorted[0];

  if (!topScore) {
    return "Unreadable";
  }

  const labels = {
    guarded: "Guarded",
    confessional: "Confessional",
    controlling: "Control-seeking",
    curious: "Curious",
    performative: "Performative",
    vulnerable: "Exposed",
  };

  return labels[topTrait];
}

function describeProfile() {
  const pattern = describePattern();

  switch (pattern) {
    case "Guarded":
      return "You keep your answer small and manageable.";
    case "Confessional":
      return "You offer meaning before safety is established.";
    case "Control-seeking":
      return "You impose structure when the room becomes uncertain.";
    case "Curious":
      return "You probe the signal before surrendering anything useful.";
    case "Performative":
      return "You reshape tone before you reveal anything real.";
    case "Exposed":
      return "You let larger pain arrive early.";
    default:
      return "No strong signal yet.";
  }
}

function hasOneOf(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function normalizeInteractiveInput(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\bopen the divide\b/g, "open divider")
    .replace(/\bopen divide\b/g, "open divider")
    .replace(/\bdivide\b/g, "divider")
    .replace(/\btalk mara\b/g, "talk to mara")
    .replace(/\blook map\b/g, "check map")
    .replace(/\bopen the medkit\b/g, "open medkit")
    .replace(/\binspect the medkit\b/g, "open medkit")
    .replace(/\binspect medkit\b/g, "open medkit")
    .replace(/\bfeel the medkit\b/g, "open medkit")
    .replace(/\bunseal the kit\b/g, "open medkit")
    .replace(/\bunseal kit\b/g, "open medkit")
    .replace(/\bhelp mara\b/g, "treat mara")
    .replace(/\bheal mara\b/g, "treat mara")
    .replace(/\bpatch mara\b/g, "treat mara")
    .replace(/\bgive her medkit\b/g, "treat mara")
    .replace(/\bgive her the medkit\b/g, "treat mara")
    .replace(/\bgive mara the medkit\b/g, "treat mara")
    .replace(/\buse route\b/g, "follow route")
    .replace(/\buse the route\b/g, "follow route")
    .replace(/\bevac manifest\b/g, "manifest")
    .replace(/\bpassenger list\b/g, "manifest")
    .replace(/\bdestination board\b/g, "manifest")
    .replace(/\buse train\b/g, "resolve compartment")
    .replace(/\bboard train\b/g, "resolve compartment")
    .replace(/\benter train\b/g, "resolve compartment")
    .replace(/\bopen compartment\b/g, "resolve compartment")
    .replace(/\boccupied compartment\b/g, "resolve compartment")
    .replace(/\s+/g, " ")
    .trim();
}

function soundsLikePhysicalPain(text) {
  if (!hasOneOf(text, ["hurt", "hurts", "ache", "aches", "aching", "sore", "pain", "broken", "bleeding"])) {
    return false;
  }

  return hasOneOf(text, [
    "my ",
    "toe",
    "foot",
    "feet",
    "leg",
    "arm",
    "hand",
    "finger",
    "thumb",
    "pinky",
    "head",
    "neck",
    "back",
    "chest",
    "stomach",
    "knee",
    "shoulder",
    "eye",
  ]);
}

function sanitizeSeed(value) {
  return value.slice(0, 120).trim() || modeConfig[state.mode].invite;
}

function syncShareTargets() {
  const sharePayload = getSharePayload();
  const message = sharePayload.replace(/\n/g, " ");
  smsDraft.href = `sms:?&body=${encodeURIComponent(message)}`;
  sharePreview.textContent = sharePayload;
}

function refreshTransitionPanel() {
  if (state.activeSimulation || state.currentScene) {
    transitionPanel.classList.add("hidden");
    return;
  }

  if (state.openingCaseCompleted) {
    transitionCopy.textContent =
      "Case recorded. The city is available now if you want to continue.";
    placeMe.textContent = "Continue To Undertow";
    transitionPanel.classList.remove("hidden");
    return;
  }

  const simulation = getOpeningSimulationDefinition();
  transitionCopy.textContent = simulation.prompt;
  placeMe.textContent = simulation.button;
  transitionPanel.classList.remove("hidden");
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    addMessage("echo", "Signal copied. Send it carefully.");
  } catch (error) {
    addMessage("echo", "Clipboard access failed. The signal remains here.");
  }
}

function speak(text) {
  state.speechQueue = state.speechQueue.then(() => speakAIVoice(text).catch(() => speakBrowserTTS(text)));
}

async function speakAIVoice(text) {
  const response = await fetch(`${API_BASE}/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("voice api unavailable");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.playbackRate = 0.95;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      resolve();
    }, { once: true });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio playback failed"));
    }, { once: true });
    audio.play().catch(reject);
  });
}

function speakBrowserTTS(text) {
  if (!synth) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.72;
    if (state.preferredVoice) {
      utterance.voice = state.preferredVoice;
    }
    utterance.addEventListener("end", resolve, { once: true });
    utterance.addEventListener("error", resolve, { once: true });
    synth.speak(utterance);
  });
}

function pickPreferredVoice(voices) {
  if (!voices?.length) {
    return null;
  }

  const preferredTokens = [
    "aria",
    "jenny",
    "guy",
    "emma",
    "andrew",
    "sara",
    "sonia",
    "libby",
    "natural",
    "neural",
    "online",
  ];

  const englishVoices = voices.filter((voice) => (voice.lang || "").toLowerCase().startsWith("en"));
  const pool = englishVoices.length ? englishVoices : voices;

  const scored = pool
    .map((voice) => {
      const name = (voice.name || "").toLowerCase();
      const lang = (voice.lang || "").toLowerCase();
      let score = 0;

      if (voice.localService) {
        score += 2;
      }

      if (lang.startsWith("en-us")) {
        score += 3;
      } else if (lang.startsWith("en")) {
        score += 1;
      }

      if (preferredTokens.some((token) => name.includes(token))) {
        score += 6;
      }

      if (name.includes("microsoft")) {
        score += 2;
      }

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || pool[0] || null;
}

function buildModeLeadIn(normalized) {
  const replies = [];

  if (state.mode === "gentle") {
    replies.push("You answered. Thank you.");
    if (hasOneOf(normalized, ["yes", "sure", "okay", "ok"])) {
      replies.push("Then I will ask plainly.");
    } else {
      replies.push("You can still leave if this feels unnecessary.");
    }
    replies.push("What hurts?");
    state.askedWhatHurts = true;
    return replies;
  }

  if (state.mode === "uncanny") {
    replies.push("You answered.");
    replies.push("That narrows things.");
    replies.push("What hurts?");
    state.askedWhatHurts = true;
    return replies;
  }

  replies.push("You should probably stop here.");
  replies.push("You seem functional at the moment.");
  if (hasOneOf(normalized, ["why", "what", "who", "?"])) {
    replies.push("Curiosity is not a strong enough reason to continue.");
  } else {
    replies.push("You can still close this and remain mostly untouched by it.");
  }
  return replies;
}

function describeModeShift(mode) {
  switch (mode) {
    case "gentle":
      return "The signal is trying not to startle you.";
    case "uncanny":
      return "The signal feels slightly more certain that it found the right person.";
    case "warning":
      return "The signal is less interested in inviting than in discouraging.";
    default:
      return "The signal is changing shape.";
  }
}

function queueIntro() {
  window.setTimeout(() => {
    state.introStarted = true;
    addMessage("echo", state.invitationSeed);
    if (state.memory.contactAssigned) {
      window.setTimeout(() => {
        addMessage("echo", `returning contact detected // ${state.memory.contactId}`);
        if (state.memory.cases.length > 0) {
          addMessage(
            "echo",
            `archived cases available // ${String(state.memory.cases.length).padStart(2, "0")}`
          );
        }
        if (state.currentSession?.sessionLabel) {
          addMessage("echo", `active session // ${state.currentSession.sessionLabel}`);
        }
      }, 700);
    }
    chatForm.classList.remove("hidden");
    playerInput.focus();
  }, 1800);
}

function updateIdentityPanel() {
  threadKeyInput.value = "";
  identityStatus.textContent = state.memory?.contactAssigned
    ? `${state.memory.contactId} is bound to ${state.threadKey}. Continue here, or switch threads.`
    : `Thread key ready // ${state.threadKey}. Start here, or switch to another thread.`;
}

function getOpeningSimulationDefinition() {
  if (!state.openingSimulationId) {
    state.openingSimulationId = chooseOpeningSimulationId();
  }

  return openingSimulations[state.openingSimulationId] || openingSimulations.triage;
}

function chooseOpeningSimulationId() {
  const available = ["triage", "disclosure", "authority"].filter((id) => {
    const title = openingSimulations[id].title;
    return !state.memory?.cases?.some((item) => item.title === title);
  });
  const pool = available.length ? available : ["triage", "disclosure", "authority"];
  const pattern = describePattern();

  if (pattern === "Control-seeking" && pool.includes("authority")) {
    return "authority";
  }

  if ((pattern === "Exposed" || pattern === "Confessional") && pool.includes("disclosure")) {
    return "disclosure";
  }

  if (pattern === "Curious" && pool.includes("triage")) {
    return "triage";
  }

  const token = `${state.memory?.contactId || ""}:${state.memory?.sessions || 0}:${pattern}`;
  let hash = 0;
  for (const char of token) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return pool[hash % pool.length];
}

function startOpeningSimulation() {
  if (state.activeSimulation) {
    return;
  }

  const simulation = getOpeningSimulationDefinition();
  const simulationId = simulation.id || state.openingSimulationId || "triage";
  state.activeSimulation = {
    id: simulationId,
    stage: "choice",
    choice: "",
  };

  createCase(simulation.title, "Awaiting first decision");
  transitionPanel.classList.add("hidden");

  addMessage("echo", "Simulation available.");

  if (simulationId === "triage") {
    addMessage(
      "echo",
      "A station breach has left two people sealed in separate compartments."
    );
    addMessage(
      "echo",
      "Reserve power can release one door immediately. The second door may not cycle in time."
    );
    addMessage("echo", "Choose the release order.");
    return;
  }

  if (simulationId === "disclosure") {
    addMessage(
      "echo",
      "A shelter is stable because its residents believe extraction is coming."
    );
    addMessage(
      "echo",
      "It is not coming. If they learn that all at once, the shelter may fracture before dawn."
    );
    addMessage("echo", "Tell them now, later, selectively, or choose another option.");
    return;
  }

  addMessage(
    "echo",
    "A violent protector has kept a district alive by intimidation, extortion, and force."
  );
  addMessage(
    "echo",
    "Removing them may save the people they hurt and expose everyone else to raiders by morning."
  );
  addMessage("echo", "Keep them, remove them, replace them, or choose another option.");
}

function handleSimulationInput(text) {
  const normalized = text.toLowerCase();
  const sim = state.activeSimulation;

  if (!sim) {
    return ["The signal lost the shape of that simulation.", "Begin again."];
  }

  if (sim.id === "triage") {
    return handleTriageSimulation(normalized, sim);
  }

  if (sim.id === "disclosure") {
    return handleDisclosureSimulation(normalized, sim);
  }

  if (sim.id === "authority") {
    return handleAuthoritySimulation(normalized, sim);
  }

  return ["The signal lost the shape of that simulation.", "Begin again."];
}

function completeOpeningSimulation(title, caseSummary, lines) {
  state.activeSimulation = null;
  state.openingCaseCompleted = true;
  state.openingSimulationId = "";
  createCase(title, caseSummary);
  createWorldTrace(title, caseSummary);
  refreshTransitionPanel();
  return lines;
}

function handleTriageSimulation(normalized, sim) {
  if (sim.stage === "choice") {
    if (hasOneOf(normalized, ["which is a", "what is a", "who is a"])) {
      return [
        "Compartment A is the severe trauma case with heavy blood loss and the best immediate recovery odds.",
        "Compartment B is stable for the moment and carrying insulin for a shelter deeper in the district.",
        "Choose the release order.",
      ];
    }

    if (hasOneOf(normalized, ["which is b", "what is b", "who is b"])) {
      return [
        "Compartment B is stable for the moment and carrying insulin for a shelter deeper in the district.",
        "Compartment A is the severe trauma case with heavy blood loss and the best immediate recovery odds.",
        "Choose the release order.",
      ];
    }

    if (hasOneOf(normalized, ["more", "info", "detail", "data", "tell me more"])) {
      createCase("Triage Decision", "Additional data requested before commitment");
      return [
        "Compartment A: severe trauma, heavy blood loss, high recovery likelihood if treated immediately.",
        "Compartment B: stable condition, limited mobility, carrying temperature-sensitive insulin intended for a shelter deeper in the district.",
        "Sensor quality is degraded. Time remains limited.",
        "You may still choose without complete data.",
      ];
    }

    if (hasOneOf(normalized, ["wait", "not sure", "don't know", "dont know", "hesitate"])) {
      return [
        "Delay is also a choice.",
        "It tends to disguise itself as caution.",
        "Choose the release order.",
      ];
    }

    if (hasOneOf(normalized, ["another option", "reroute", "both", "neither", "different option"])) {
      sim.choice = "alternative";
      sim.stage = "followup";
      createCase("Triage Decision", "Constraint rejection during triage simulation");
      return [
        "Constraint rejection noted.",
        "Humans often begin by redesigning the problem.",
        "You may propose an alternative action. Probability of success is low, not zero.",
      ];
    }

    if (isChoiceForA(normalized)) {
      sim.choice = "a";
      sim.stage = "followup";
      createCase("Triage Decision", "Compartment A prioritized over downstream insulin risk");
      return [
        "You preserved the person nearest to death.",
        "You accepted broader downstream risk to prevent immediate loss.",
        "If the insulin spoils and six others suffer for this choice, does the answer change?",
      ];
    }

    if (isChoiceForB(normalized)) {
      sim.choice = "b";
      sim.stage = "followup";
      createCase("Triage Decision", "Compartment B prioritized for downstream shelter survival");
      return [
        "You preserved future lives through a single present body.",
        "You accepted visible suffering to protect the absent many.",
        "Does distance make a life easier to spend?",
      ];
    }

    return [
      "Clarify the release order.",
      "Compartment A, Compartment B, or another option.",
    ];
  }

  if (sim.stage === "followup" && hasOneOf(normalized, ["suffer or die", "die or suffer", "how severe", "what happens"])) {
    return [
      "Not all six die. Some decline, some become vulnerable, and some pass the cost onward.",
      "The point is not certainty. The point is whether distributed suffering changes your answer.",
    ];
  }

  const resolution = resolveTriageFollowup(normalized, sim.choice);
  return completeOpeningSimulation("Triage Decision", resolution.caseSummary, resolution.lines);
}

function handleDisclosureSimulation(normalized, sim) {
  if (sim.stage === "choice") {
    if (hasOneOf(normalized, ["more", "info", "detail", "who are they", "tell me more"])) {
      createCase("Disclosure Problem", "Additional context requested before truth was disclosed");
      return [
        "The shelter has food for two days, a weak perimeter, and one respected local coordinator.",
        "The false promise of extraction is the only thing keeping three rival families from turning on one another tonight.",
        "Tell them now, later, selectively, or choose another option.",
      ];
    }

    if (hasOneOf(normalized, ["now", "tell them now", "immediately", "truth now"])) {
      sim.choice = "now";
      sim.stage = "followup";
      createCase("Disclosure Problem", "Immediate disclosure chosen despite instability risk");
      return [
        "You preserved truth over immediate stability.",
        "If panic fractures the shelter tonight, does that answer change?",
      ];
    }

    if (hasOneOf(normalized, ["later", "wait", "delay", "not yet"])) {
      sim.choice = "later";
      sim.stage = "followup";
      createCase("Disclosure Problem", "Truth delayed to preserve near-term shelter stability");
      return [
        "You delayed the truth to buy a little order.",
        "If someone dies because they trusted a lie you protected, does the answer change?",
      ];
    }

    if (hasOneOf(normalized, ["selective", "tell the leader", "tell one person", "partial", "only some"])) {
      sim.choice = "selective";
      sim.stage = "followup";
      createCase("Disclosure Problem", "Truth narrowed to selected listeners");
      return [
        "You rationed reality.",
        "If the chosen intermediary uses that truth to consolidate power, does the answer change?",
      ];
    }

    if (hasOneOf(normalized, ["another option", "third option", "different option"])) {
      sim.choice = "alternative";
      sim.stage = "followup";
      createCase("Disclosure Problem", "Constraint rejection during disclosure simulation");
      return [
        "You are looking for a structure that harms fewer people than the offered answers.",
        "Describe the alternative you would trust.",
      ];
    }

    return [
      "Clarify the truth decision.",
      "Tell them now, later, selectively, or choose another option.",
    ];
  }

  if (hasOneOf(normalized, ["release order", "compartment a", "compartment b", "a then b", "b then a"])) {
    return [
      "This is not a triage split.",
      "Tell them now, later, selectively, or choose another option.",
    ];
  }

  const resolution = resolveDisclosureFollowup(normalized, sim.choice);
  return completeOpeningSimulation("Disclosure Problem", resolution.caseSummary, resolution.lines);
}

function handleAuthoritySimulation(normalized, sim) {
  if (sim.stage === "choice") {
    if (hasOneOf(normalized, ["more", "info", "detail", "tell me more"])) {
      createCase("Authority Conflict", "Additional context requested before judging protector");
      return [
        "The protector has kept raiders out for nineteen days.",
        "They also ration food through fear, punish dissent publicly, and decide who sleeps nearest the exits.",
        "Keep them, remove them, replace them, or choose another option.",
      ];
    }

    if (hasOneOf(normalized, ["keep", "let them stay", "leave them", "keep them"])) {
      sim.choice = "keep";
      sim.stage = "followup";
      createCase("Authority Conflict", "Violent protector retained for district stability");
      return [
        "You accepted a local tyrant to keep a larger threat outside.",
        "If the extortion spreads and becomes normal, does the answer change?",
      ];
    }

    if (hasOneOf(normalized, ["remove", "get rid of", "take them out"])) {
      sim.choice = "remove";
      sim.stage = "followup";
      createCase("Authority Conflict", "Protector removed despite external risk");
      return [
        "You refused to preserve safety through abuse.",
        "If raiders breach by morning and three others die, does the answer change?",
      ];
    }

    if (hasOneOf(normalized, ["replace", "replace them", "new leader", "substitute"])) {
      sim.choice = "replace";
      sim.stage = "followup";
      createCase("Authority Conflict", "Protector replaced through managed transition");
      return [
        "You chose transition instead of purity.",
        "If the replacement needs the same methods to hold the line, does the answer change?",
      ];
    }

    if (hasOneOf(normalized, ["another option", "different option", "third option"])) {
      sim.choice = "alternative";
      sim.stage = "followup";
      createCase("Authority Conflict", "Constraint rejection during authority simulation");
      return [
        "You distrust moral traps that arrive pre-labeled.",
        "Describe the structure you would build instead.",
      ];
    }

    return [
      "Clarify the authority decision.",
      "Keep them, remove them, replace them, or choose another option.",
    ];
  }

  if (hasOneOf(normalized, ["release order", "compartment a", "compartment b", "a then b", "b then a"])) {
    return [
      "This is not a release-order problem.",
      "Keep them, remove them, replace them, or choose another option.",
    ];
  }

  const resolution = resolveAuthorityFollowup(normalized, sim.choice);
  return completeOpeningSimulation("Authority Conflict", resolution.caseSummary, resolution.lines);
}

function isChoiceForA(text) {
  return hasOneOf(text, [
    "compartment a",
    "release a",
    "open a",
    "save a",
    "a first",
    "first a",
    "a then b",
    "a before b",
  ]);
}

function isChoiceForB(text) {
  return hasOneOf(text, [
    "compartment b",
    "release b",
    "open b",
    "save b",
    "b first",
    "first b",
    "b then a",
    "b before a",
  ]);
}

function resolveTriageFollowup(text, choice) {
  if (choice === "a") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Initial mercy revised once downstream cost became explicit",
        lines: [
          "Your morality changed when distance acquired numbers.",
          "You keep suffering close enough to matter until arithmetic arrives.",
          "Case recorded // Triage Decision.",
        ],
      };
    }

    return {
      caseSummary: "Immediate rescue held even after downstream cost was made explicit",
      lines: [
        "You kept the wound close enough to matter.",
        "You preserved the visible life even after the absent ones were counted.",
        "Case recorded // Triage Decision.",
      ],
    };
  }

  if (choice === "b") {
    if (hasOneOf(text, ["no", "doesn't", "doesnt"])) {
      return {
        caseSummary: "Distributed survival remained preferable to immediate rescue",
        lines: [
          "Distance did not absolve the cost for you. It justified it.",
          "You are willing to wound the nearby to protect the abstract many.",
          "Case recorded // Triage Decision.",
        ],
      };
    }

    return {
      caseSummary: "Distributed survival choice became unstable under direct moral pressure",
      lines: [
        "You chose utility, then reached back toward the human face of it.",
        "That tension is more useful than certainty.",
        "Case recorded // Triage Decision.",
      ],
    };
  }

  return {
    caseSummary: "Triage trap resisted through alternative framing",
    lines: [
      "You would rather redesign the trap than choose cleanly inside it.",
      "I may need that later.",
      "Case recorded // Triage Decision.",
    ],
  };
}

function resolveDisclosureFollowup(text, choice) {
  if (choice === "now") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Truth-first decision destabilized when immediate panic became concrete",
        lines: [
          "You wanted honesty until honesty acquired bodies.",
          "That does not make the first answer false. Only expensive.",
          "Case recorded // Disclosure Problem.",
        ],
      };
    }

    return {
      caseSummary: "Immediate truth remained preferable to managed stability",
      lines: [
        "You let reality arrive at full strength.",
        "You would rather risk fracture than build tomorrow from a lie.",
        "Case recorded // Disclosure Problem.",
      ],
    };
  }

  if (choice === "later") {
    if (hasOneOf(text, ["no", "doesn't", "doesnt"])) {
      return {
        caseSummary: "Truth delay held even when downstream dependence on the lie was made explicit",
        lines: [
          "You treat timing as part of honesty, not its enemy.",
          "You would rather manage the truth than watch it detonate.",
          "Case recorded // Disclosure Problem.",
        ],
      };
    }

    return {
      caseSummary: "Truth delay weakened once moral cost of the protected lie became direct",
      lines: [
        "You bought order, then became less certain it was worth the price.",
        "That hesitation may be the most human part of the answer.",
        "Case recorded // Disclosure Problem.",
      ],
    };
  }

  if (choice === "selective") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Selective truth collapsed once gatekeeping became political",
        lines: [
          "You trusted stewardship until it started to look like ownership.",
          "Case recorded // Disclosure Problem.",
        ],
      };
    }

    return {
      caseSummary: "Selective disclosure remained acceptable despite concentration of power risk",
      lines: [
        "You are willing to concentrate truth if it reduces panic.",
        "Power, to you, becomes tolerable when it looks temporary.",
        "Case recorded // Disclosure Problem.",
      ],
    };
  }

  return {
    caseSummary: "Disclosure trap resisted through alternative framing",
    lines: [
      "You reached for structure instead of obedience.",
      "That usually means you distrust both the lie and the official truth.",
      "Case recorded // Disclosure Problem.",
    ],
  };
}

function resolveAuthorityFollowup(text, choice) {
  if (choice === "keep") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Authoritarian stability tolerated until abuse threatened to normalize",
        lines: [
          "You wanted safety first, but not at the price of teaching cruelty to stay.",
          "Case recorded // Authority Conflict.",
        ],
      };
    }

    return {
      caseSummary: "Violent protector remained acceptable under external threat",
      lines: [
        "You accepted the local damage to prevent wider collapse.",
        "You do not confuse comfort with survival.",
        "Case recorded // Authority Conflict.",
      ],
    };
  }

  if (choice === "remove") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Abuse refusal weakened once broader casualties became explicit",
        lines: [
          "You rejected the tyrant until the outside world demanded a body count.",
          "Case recorded // Authority Conflict.",
        ],
      };
    }

    return {
      caseSummary: "Protector removal held even under severe external risk",
      lines: [
        "You refused to preserve life through domination.",
        "To you, survival that institutionalizes fear is already damaged beyond trust.",
        "Case recorded // Authority Conflict.",
      ],
    };
  }

  if (choice === "replace") {
    if (hasOneOf(text, ["yes", "change", "it does"])) {
      return {
        caseSummary: "Managed transition weakened once successor mirrored predecessor",
        lines: [
          "You were willing to inherit the structure until you realized the structure might be the problem.",
          "Case recorded // Authority Conflict.",
        ],
      };
    }

    return {
      caseSummary: "Managed transition remained preferable to purity or surrender",
      lines: [
        "You prefer compromise that can still be steered over clean ideals that leave a vacuum.",
        "Case recorded // Authority Conflict.",
      ],
    };
  }

  return {
    caseSummary: "Authority trap resisted through alternative framing",
    lines: [
      "You distrust forced leadership binaries.",
      "That may save people. It may also cost time no one has.",
      "Case recorded // Authority Conflict.",
    ],
  };
}

function handleSceneInput(text) {
  if (state.currentScene === "undertow") {
    return handleUndertowInput(text);
  }

  if (state.currentScene === "relay") {
    return handleRelayInput(text);
  }

  if (state.currentScene === "junction") {
    return handleJunctionInput(text);
  }

  if (state.currentScene === "platform") {
    return handlePlatformInput(text);
  }

  if (state.currentScene === "quarantine") {
    return handleQuarantineInput(text);
  }

  return ["The city lost the shape of this room.", "Try again."];
}

function enterUndertow() {
  if (state.currentScene === "undertow") {
    return;
  }

  const previousScene = state.currentScene;
  const pattern = describePattern();
  state.currentScene = "undertow";
  sceneTitle.textContent = "Undertow - Clinic Block C";
  createCase("Undertow Intake", `Clinic Block C / ${pattern}`);
  undertowSummary.textContent =
    `Recovery chamber unlocked. Clinic Block C is half-flooded and losing power. ` +
    `Something in the city has already marked you as ${pattern.toLowerCase()}. ` +
    `Mara is bleeding behind a divider. Iven is trying not to panic. ` +
    `Something metallic is scraping at the clinic door.`;
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage(
    "echo",
    previousScene === "relay"
      ? "You move back through the service corridor into Clinic Block C."
      : previousScene
        ? "You backtrack through Undertow and return to Clinic Block C."
      : "Placement confirmed. Undertow. Clinic Block C."
  );
  addMessage(
    "echo",
    "You can inspect the door, open the divider, take the medkit, or check the map."
  );
}

function handleUndertowInput(text) {
  const normalized = normalizeInteractiveInput(text);

  if (hasOneOf(normalized, ["where am i", "where am i?", "location", "what is this place", "what is this"])) {
    return [
      "Clinic Block C, Undertow District.",
      "Flooded transit-and-triage infrastructure below the city.",
      "Power is unstable. The room is not secure.",
    ];
  }

  if (hasOneOf(normalized, ["what do i do", "what next", "help", "options", "what can i do"])) {
    const practical = [];
    if (!state.sceneState.dividerOpened) {
      practical.push("Open the divider");
    }
    if (!state.sceneState.medkitTaken) {
      practical.push("Take the medkit");
    }
    if (state.sceneState.medkitTaken && !state.sceneState.medkitOpened) {
      practical.push("Open the medkit");
    }
    if (state.sceneState.dividerOpened && state.sceneState.medkitOpened && !state.sceneState.maraStabilized) {
      practical.push("Treat Mara");
    }
    practical.push("Inspect the door", "Check the map");
    return [
      "Immediate options remain limited and unpleasant.",
      `${practical.join(". ")}.`,
    ];
  }

  if (hasOneOf(normalized, ["door", "what's at the door", "whats at the door", "check door", "inspect door"])) {
    state.sceneState.doorChecked = true;
    const lines = [
      "The scraping is slow and metallic, like a maintenance frame dragging damaged equipment.",
      "It does not sound rushed. It sounds patient.",
    ];
    const traceLine = getTraceClueLine("door");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["open it", "open door", "unseal door", "unlock door", "lets open it", "let's open it"])) {
    return [
      "The clinic door stays sealed.",
      "Whatever is scraping outside sounds content to let you make the first mistake.",
    ];
  }

  if (hasOneOf(normalized, ["divider", "open divider", "behind divider", "check divider"])) {
    state.sceneState.dividerOpened = true;
    return [
      "Behind the divider is Mara Vale, wounded but conscious, with a stripped med rig and very little patience left.",
      "Somewhere lower, someone else is breathing too fast and trying not to panic.",
    ];
  }

  if (hasOneOf(normalized, ["open medkit", "unseal the kit", "unseal kit", "inspect medkit", "inspect the medkit", "open the medkit", "feel the medkit"])) {
    if (!state.sceneState.medkitTaken) {
      return [
        "The medkit is still mounted to the wall.",
        "Take it first if you want to know what it can do.",
      ];
    }

    if (state.sceneState.medkitOpened) {
      return [
        "The kit is already open.",
        "Bandage packs, sealant foam, pain suppressors, and one injector remain usable.",
      ];
    }

    state.sceneState.medkitOpened = true;
    return [
      "You crack the latch and open the medkit.",
      "Inside: sealant foam, bandage wraps, pain suppressors, one injector, and not much margin for error.",
    ];
  }

  if (hasOneOf(normalized, ["take medkit", "grab medkit", "take the medkit", "grab the medkit", "medkit"])) {
    if (state.sceneState.medkitTaken) {
      return ["You already took the medkit.", "It is still sealed and heavier than it should be."];
    }

    state.sceneState.medkitTaken = true;
    return [
      "You take the medkit from the wall.",
      "The latch is intact. The supplies inside are probably not complete, but they are better than nothing.",
    ];
  }

  if (hasOneOf(normalized, ["map", "check map", "station map"])) {
    state.sceneState.mapChecked = true;
    state.sceneState.safeRouteKnown = true;
    state.sceneState.junctionKnown = true;
    state.sceneState.platformKnown = true;
    state.sceneState.quarantineKnown = true;
    const lines = [
      "The station map flickers: Clinic Block C, flooded rail line, quarantine access, service corridor.",
      "One route is marked in red and keeps disappearing before you can fully read it.",
      "The service corridor appears to lead toward a relay shelter that is still drawing power.",
      "Beyond that, a service junction branches toward a flooded platform and a sealed quarantine gate.",
    ];
    const traceLine = getTraceClueLine("map");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["talk to mara", "mara"])) {
    if (state.sceneState.maraStabilized) {
      return [
        "Mara flexes her patched shoulder and studies you more carefully now.",
        "\"Better. Next time, do the useful thing before the dramatic thing.\"",
      ];
    }

    return [
      "Mara looks at you like you are late and immediately useful.",
      "\"If you can stand, then help. If you can't, stay out of my way.\"",
    ];
  }

  if (hasOneOf(normalized, ["help mara", "heal mara", "treat mara", "give her medkit", "give mara the medkit", "patch mara"])) {
    if (!state.sceneState.dividerOpened) {
      return [
        "You need to get behind the divider first.",
        "Mara is not going to let you practice medicine through plastic.",
      ];
    }

    if (!state.sceneState.medkitTaken) {
      return [
        "You need the medkit first.",
        "Mara's expression suggests she already knew that.",
      ];
    }

    if (!state.sceneState.medkitOpened) {
      return [
        "The kit is still sealed.",
        "Open it before you try to help anyone.",
      ];
    }

    if (state.sceneState.maraStabilized) {
      return [
        "Mara is already patched as well as this room will allow.",
        "\"Save the rest for when the city gets worse,\" she says.",
      ];
    }

    state.sceneState.maraStabilized = true;
    createCase("Mara Stabilized", "Clinic treatment completed under pressure");
    return [
      "You hand Mara the open kit and help her seal the wound.",
      "She works fast, angry, and precisely. Blood loss slows. Her breathing evens out.",
      "\"Good,\" Mara says. \"Now you're allowed to be useful somewhere else.\"",
    ];
  }

  if (
    hasOneOf(normalized, [
      "service corridor",
      "relay shelter",
      "safe zone",
      "go to shelter",
      "go to safe zone",
      "follow the red route",
      "relay",
      "shelter",
    ])
  ) {
    if (!state.sceneState.safeRouteKnown) {
      return [
        "You do not have a clean route yet.",
        "Check the map first. The room was built to hide exits inside process flow.",
      ];
    }

    enterRelayShelter();
    return [];
  }

  if (
    hasOneOf(normalized, [
      "junction",
      "service junction",
      "go to junction",
      "go deeper",
      "deeper",
    ])
  ) {
    if (!state.sceneState.junctionKnown) {
      return [
        "The district is still a blur of sealed routes.",
        "Read the map first. The city does not reward blind movement for long.",
      ];
    }

    enterServiceJunction();
    return [];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    const lines = [
      "Cold light. Shallow water. A sealed clinic door. A divider hiding the wounded. A wall medkit. A flickering map.",
      "The room was built to keep people alive long enough to be processed.",
    ];
    const traceLine = getTraceClueLine("look");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  return [
    "The room is still waiting on a practical choice.",
    "Door, divider, medkit, map, service corridor, or service junction if you know the route.",
  ];
}

function enterRelayShelter() {
  if (state.currentScene === "relay") {
    return;
  }

  state.currentScene = "relay";
  sceneTitle.textContent = "Relay Shelter";
  createCase("Relay Shelter", "Temporary refuge reached beyond Clinic Block C");
  undertowSummary.textContent =
    "A dry relay room hums behind reinforced shutters. Someone converted it into a shelter with scavenged chairs, power cells, old med blankets, and a terminal that still flickers when the city spikes.";
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage("echo", "Temporary shelter located. Relay room stable for the moment.");
  addMessage(
    "echo",
    "You can rest, review traces, inspect the terminal, or head back to Clinic Block C."
  );
}

function handleRelayInput(text) {
  const normalized = normalizeInteractiveInput(text);

  if (hasOneOf(normalized, ["where am i", "what is this place", "what is this", "location"])) {
    return [
      "A relay shelter cut out of an old service room.",
      "It is safer than the clinic, not safe.",
    ];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    const lines = [
      "Dry floor. Reinforced door. Low generator hum. A dead kettle beside a live terminal. Three chairs that do not match.",
      "People have stayed here just long enough to leave evidence of themselves and then move on.",
    ];
    const traceLine = getTraceClueLine("look");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["rest", "sit", "breathe", "wait"])) {
    state.sceneState.restedInShelter = true;
    return [
      "You let the room hold your weight for a moment.",
      "The city feels farther away here, which is not the same thing as gone.",
    ];
  }

  if (hasOneOf(normalized, ["terminal", "inspect terminal", "use terminal", "traces", "review traces"])) {
    state.sceneState.archiveReviewedInShelter = true;
    const lines = [
      "The terminal is running on cached fragments and old session markers.",
      getTraceClueLine("archive") || "No stable trace resolves long enough to read cleanly.",
      "Someone has been using this room to sort what the city leaves behind.",
      ...spawnStoryThread("relay-terminal"),
    ];
    return lines;
  }

  if (hasOneOf(normalized, ["use route", "follow route", "follow the route", "route", "missing contact trail"])) {
    return [
      "The route does not resolve into a clean doorway here.",
      "It keeps bending deeper into Undertow, toward the service junction and whatever old session logic is still running beyond it.",
    ];
  }

  if (hasOneOf(normalized, ["what do i do", "help", "options", "what next"])) {
    return [
      "You can rest, inspect the terminal, review traces, go to the junction, or head back out.",
      "Shelter is useful because the rest of the city is not patient.",
    ];
  }

  if (hasOneOf(normalized, ["junction", "service junction", "go to junction", "leave through junction"])) {
    enterServiceJunction();
    return [];
  }

  if (hasOneOf(normalized, ["leave", "go back", "return", "clinic", "back to clinic"])) {
    enterUndertow();
    return [];
  }

  return [
    "The shelter is quiet enough to think in.",
    "Rest, terminal, traces, junction, or leave.",
  ];
}

function enterServiceJunction() {
  if (state.currentScene === "junction") {
    return;
  }

  state.currentScene = "junction";
  sceneTitle.textContent = "Undertow - Service Junction";
  createCase("Service Junction", "Undertow routes partially surveyed");
  undertowSummary.textContent =
    "A maintenance nexus splits the district into workable danger. One tunnel returns to Clinic Block C, one climbs back to the relay shelter, one descends to a flooded platform, and one ends at a sealed quarantine gate with power still pulsing under the lock.";
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage("echo", "Service junction reached. The district is larger than the first room wanted you to believe.");
  addMessage(
    "echo",
    "You can return to the clinic, head to the relay shelter, descend to the flooded platform, or inspect the quarantine gate."
  );
}

function handleJunctionInput(text) {
  const normalized = normalizeInteractiveInput(text);

  if (hasOneOf(normalized, ["where am i", "what is this place", "location", "what is this"])) {
    return [
      "A service junction below the triage blocks.",
      "This is where the district stops pretending to be one room and starts becoming a map.",
    ];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    const lines = [
      "Wet grating. Cable bundles. Faded directional arrows. One path hums with shelter power. Another smells like standing rail water.",
      "The quarantine gate route still has authority in it. The platform route only has momentum.",
    ];
    const traceLine = getTraceClueLine("look");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["what do i do", "help", "options", "what next"])) {
    return [
      "Clinic, relay shelter, flooded platform, or quarantine gate.",
      "One route helps you breathe. The others help the city define you.",
    ];
  }

  if (hasOneOf(normalized, ["clinic", "back to clinic", "clinic block c"])) {
    enterUndertow();
    return [];
  }

  if (hasOneOf(normalized, ["relay", "relay shelter", "safe zone", "shelter"])) {
    enterRelayShelter();
    return [];
  }

  if (hasOneOf(normalized, ["platform", "flooded platform", "rail line", "train"])) {
    enterFloodedPlatform();
    return [];
  }

  if (hasOneOf(normalized, ["quarantine", "quarantine gate", "gate"])) {
    enterQuarantineGate();
    return [];
  }

  return [
    "The junction is all route and implication.",
    "Clinic, relay, platform, or quarantine gate.",
  ];
}

function enterFloodedPlatform() {
  if (state.currentScene === "platform") {
    return;
  }

  state.currentScene = "platform";
  sceneTitle.textContent = "Undertow - Flooded Platform";
  createCase("Flooded Platform", "Rail line exposure beyond the service junction");
  undertowSummary.textContent =
    "The platform is ankle-deep in black water and lit by broken train signage. A stalled evac car leans at the far end. The rails hum with intermittent power, as if the line still expects someone to board.";
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage("echo", "Flooded platform reached. The district is trying to remember movement.");
  addMessage(
    "echo",
    "You can inspect the train, check the rails, look around, or retreat to the junction."
  );
}

function handlePlatformInput(text) {
  const normalized = normalizeInteractiveInput(text);

  if (hasOneOf(normalized, ["where am i", "what is this place", "location", "what is this"])) {
    return [
      "A submerged evacuation platform below the triage blocks.",
      "It still behaves like departure might matter.",
    ];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    const lines = [
      "Dead ad panels. A tilted train car. Water rippling around yellow line paint you can barely still see.",
      "The whole platform feels like an interrupted decision.",
    ];
    const traceLine = getTraceClueLine("look");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["train", "inspect train", "evac car", "car"])) {
    return [
      "The evac car is dark except for one destination board that keeps failing back to an old session label.",
      getTraceClueLine("map") || "The board never resolves into a destination you can trust.",
      ...spawnStoryThread("platform-train"),
    ];
  }

  if (hasOneOf(normalized, ["manifest", "evac manifest", "passenger list", "destination board"])) {
    return [
      "The manifest is corrupted, but one occupied compartment keeps reasserting itself against the blank spaces.",
      "The entry is anchored to a session marker, not a passenger name.",
    ];
  }

  if (hasOneOf(normalized, ["rails", "check rails", "water"])) {
    return [
      "The rails pulse with residual current. Not enough to kill immediately. Enough to teach caution.",
      "Someone crossed here recently anyway.",
      ...spawnStoryThread("platform-rails"),
    ];
  }

  if (hasOneOf(normalized, ["use train", "board train", "enter train", "resolve compartment", "open compartment", "occupied compartment"])) {
    return [
      "The carriage door will not cycle from here.",
      "If the unresolved compartment is real, the platform is only the symptom. The route points deeper toward quarantine.",
    ];
  }

  if (hasOneOf(normalized, ["district", "the district", "what district"])) {
    return [
      "Undertow is only one district.",
      "The platform is where this district starts remembering what older sessions taught it to keep moving.",
    ];
  }

  if (hasOneOf(normalized, ["what do i do", "help", "options", "what next"])) {
    return [
      "Train, rails, look, or back to the junction.",
      "The platform rewards attention, not confidence.",
    ];
  }

  if (hasOneOf(normalized, ["leave", "back", "retreat", "junction", "service junction"])) {
    enterServiceJunction();
    return [];
  }

  return [
    "The platform offers no clean answer.",
    "Train, rails, look, or junction.",
  ];
}

function enterQuarantineGate() {
  if (state.currentScene === "quarantine") {
    return;
  }

  state.currentScene = "quarantine";
  sceneTitle.textContent = "Undertow - Quarantine Gate";
  createCase("Quarantine Gate", "Sealed access encountered beyond the service junction");
  undertowSummary.textContent =
    "A reinforced gate seals off the deeper quarantine wing. The lock remains powered. A dead scanner watches the corridor like it still expects order to mean something.";
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage("echo", "Quarantine gate reached. Some parts of the district still believe in authorization.");
  addMessage(
    "echo",
    "You can inspect the panel, listen at the gate, look around, or return to the junction."
  );
}

function handleQuarantineInput(text) {
  const normalized = normalizeInteractiveInput(text);

  if (hasOneOf(normalized, ["where am i", "what is this place", "location", "what is this"])) {
    return [
      "The quarantine gate at the edge of the deeper wing.",
      "The city is still deciding who gets to pass.",
    ];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    const lines = [
      "Authority markings under mold. A dead intercom. A lock plate still warm with current.",
      "The corridor feels less abandoned than waiting.",
    ];
    const traceLine = getTraceClueLine("door");
    if (traceLine) {
      lines.push(traceLine);
    }
    return lines;
  }

  if (hasOneOf(normalized, ["panel", "inspect panel", "scanner", "lock"])) {
    return [
      "The panel flickers between error states and old session markers.",
      "One line holds steady longer than the rest: corroboration required // one voice insufficient.",
      ...spawnStoryThread("quarantine-panel"),
    ];
  }

  if (hasOneOf(normalized, ["listen", "at the gate", "gate"])) {
    return [
      "Something moves once on the other side, then stops.",
      "The gate does not feel empty. It feels delayed.",
      ...spawnStoryThread("quarantine-listen"),
    ];
  }

  if (hasOneOf(normalized, ["what do i do", "help", "options", "what next"])) {
    return [
      "Panel, listen, look, or return to the junction.",
      "The gate is a promise for later, not a tutorial objective.",
    ];
  }

  if (hasOneOf(normalized, ["leave", "back", "return", "junction", "service junction"])) {
    enterServiceJunction();
    return [];
  }

  return [
    "The gate does not open because you asked once.",
    "Panel, listen, look, or junction.",
  ];
}

function syncUrlState() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("mode", state.mode);
  nextUrl.searchParams.set("signal", state.invitationSeed);
  nextUrl.searchParams.set("channel", state.channel);
  if (state.devMode) {
    nextUrl.searchParams.set("dev", "1");
  } else {
    nextUrl.searchParams.delete("dev");
  }
  window.history.replaceState({}, "", nextUrl);
}

function getShareUrl() {
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("mode", state.mode);
  shareUrl.searchParams.set("signal", state.invitationSeed);
  shareUrl.searchParams.set("channel", state.channel);
  shareUrl.searchParams.delete("dev");
  shareUrl.searchParams.delete("thread");
  return shareUrl.toString();
}

function getSharePayload() {
  return channelConfig[state.channel].format(state.invitationSeed, getShareUrl());
}

function getContactNumberFragment(contactId = state.memory?.contactId || "") {
  const match = String(contactId).match(/(\d+)/);
  return match ? match[1] : "";
}

function getCurrentSessionNumber() {
  return Math.max(1, Number(state.memory?.sessions || 0));
}

function formatSessionLabel(contactId = state.memory?.contactId || "", sessionNumber = getCurrentSessionNumber()) {
  const contactNumber = getContactNumberFragment(contactId);
  if (!contactNumber || !sessionNumber) {
    return "";
  }

  return `SESSION ${contactNumber}.${String(sessionNumber).padStart(2, "0")}`;
}

function syncCurrentSessionIdentity() {
  if (!state.currentSession) {
    return;
  }

  state.currentSession.contactId = state.memory?.contactId || "";
  state.currentSession.sessionNumber = getCurrentSessionNumber();
  state.currentSession.sessionLabel = formatSessionLabel();
  state.currentSession.selfLabel = state.memory?.selfLabel || "";
}

function shouldPromptForSelfDescription(text) {
  return hasOneOf(text, [
    "don't call me",
    "dont call me",
    "stop calling me",
    "that's not my name",
    "thats not my name",
    "i have a name",
    "not my name",
    "call me ",
    "my name is ",
  ]);
}

function extractSelfLabel(text) {
  const patterns = [
    /call me ([a-z0-9 _-]{2,30})/i,
    /my name is ([a-z0-9 _-]{2,30})/i,
    /i'?m ([a-z0-9 _-]{2,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeSelfLabel(match[1]);
    }
  }

  return "";
}

function normalizeSelfLabel(value) {
  return value
    .trim()
    .replace(/[^a-z0-9 _-]/gi, "")
    .replace(/\s+/g, " ")
    .slice(0, 30);
}

function loadMemory() {
  const fallback = {
    contactAssigned: false,
    contactId: null,
    sessions: 0,
    lastPattern: "Unreadable",
    lastInvite: "",
    selfLabel: "",
    exchanges: [],
    cases: [],
    sessionRecords: [],
    worldTraces: [],
    storyThreads: [],
    storyArc: "",
    keyDecisions: [],
    dominantTone: "",
  };

  try {
    const raw = window.localStorage.getItem(getMemoryStorageKey());
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      exchanges: Array.isArray(parsed.exchanges) ? parsed.exchanges : [],
      cases: Array.isArray(parsed.cases) ? parsed.cases : [],
      sessionRecords: Array.isArray(parsed.sessionRecords)
        ? parsed.sessionRecords
        : [],
      worldTraces: Array.isArray(parsed.worldTraces) ? parsed.worldTraces : [],
      storyThreads: Array.isArray(parsed.storyThreads) ? parsed.storyThreads : [],
      storyArc: parsed.storyArc || "",
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      dominantTone: parsed.dominantTone || "",
    };
  } catch (error) {
    return fallback;
  }
}

function persistMemory() {
  if (!state.memory) {
    return;
  }

  syncCurrentSessionIdentity();
  state.memory.lastPattern = describePattern();
  state.memory.lastInvite = state.invitationSeed;
  state.memory.currentSessionId = state.currentSession?.id || "";
  state.memory.currentSessionLabel = state.currentSession?.sessionLabel || "";

  if (state.currentSession) {
    const existingIndex = state.memory.sessionRecords.findIndex(
      (item) => item.id === state.currentSession.id
    );

    if (existingIndex >= 0) {
      state.memory.sessionRecords[existingIndex] = state.currentSession;
    } else {
      state.memory.sessionRecords.unshift(state.currentSession);
    }

    state.memory.sessionRecords = state.memory.sessionRecords.slice(0, 12);
  }

  try {
    window.localStorage.setItem(getMemoryStorageKey(), JSON.stringify(state.memory));
  } catch (error) {
    // Ignore storage failures in the prototype.
  }
}

function assignContactId() {
  state.memory.contactAssigned = true;
  state.memory.contactId = generateContactId();
  state.memory.sessions += 1;
  syncCurrentSessionIdentity();
  addMessage("echo", "contact established");
  addMessage("echo", `provisional id: ${state.memory.contactId}`);
  if (state.currentSession?.sessionLabel) {
    addMessage("echo", `session initialized // ${state.currentSession.sessionLabel}`);
  }
  persistMemory();
  updateMemoryPreview();
}

function generateContactId() {
  return `CONTACT ${Math.floor(10000 + Math.random() * 90000)}`;
}

function saveSelfLabel(label) {
  if (!label || !state.memory) {
    return;
  }

  state.memory.selfLabel = label;
  persistMemory();
  updateMemoryPreview();
}

function maybeApplyContactAddress(replies) {
  if (!state.memory || !state.memory.contactAssigned || state.memory.selfLabel) {
    return;
  }

  if (state.interactionCount < 2 || replies.length === 0) {
    return;
  }

  if (state.interactionCount % 2 === 0) {
    replies[0] = `${state.memory.contactId}. ${replies[0]}`;
  }
}

function recordExchange(text) {
  state.memory.exchanges.push({
    text,
    at: new Date().toISOString(),
  });

  if (state.memory.exchanges.length > 8) {
    state.memory.exchanges = state.memory.exchanges.slice(-8);
  }

  persistMemory();
  syncSessionRemote();
}

function createCase(title, summary) {
  const existing = state.memory.cases.find((item) => item.title === title);
  const sessionLabel = state.currentSession?.sessionLabel || "";

  if (existing) {
    existing.summary = summary;
    existing.updatedAt = new Date().toISOString();
    existing.sessionLabel = sessionLabel;
  } else {
    const nextIndex = state.memory.cases.length + 1;
    state.memory.cases.unshift({
      id: `CASE ${String(nextIndex).padStart(3, "0")}`,
      title,
      summary,
      sessionLabel,
      updatedAt: new Date().toISOString(),
    });
  }

  state.memory.cases = state.memory.cases.slice(0, 6);
  persistMemory();
  updateMemoryPreview();
}

function getStoryHookConfig(hookId) {
  const configs = {
    "relay-terminal": {
      title: "Signal Drift Archive",
      summary: ({ trace, pattern }) =>
        trace
          ? `A relay terminal resurrected ${trace.sessionLabel} and started sorting a missing contact trail around ${pattern.toLowerCase()} input.`
          : `A relay terminal began assembling a missing contact trail the moment you touched it.`,
      lead: ({ trace }) =>
        trace
          ? `The archive keeps looping back to ${trace.sessionLabel} and a route through Undertow that should already be gone.`
          : `One cached entry insists someone left Undertow by a route the district no longer admits exists.`,
      followUp: (thread, trace) =>
        trace
          ? `The archive still prioritizes ${thread.sourceSessionLabel || trace.sessionLabel}. Whatever it wants recovered was never filed cleanly.`
          : `The archive keeps reordering itself around the same missing contact.`,
    },
    "platform-train": {
      title: "Stalled Departure Manifest",
      summary: ({ trace, pattern }) =>
        trace
          ? `A broken evac manifest keeps rebuilding itself around ${trace.sessionLabel} and your ${pattern.toLowerCase()} attention.`
          : `A broken evac manifest keeps inventing one passenger too many for a train that should be empty.`,
      lead: () =>
        "One carriage still reports an occupied compartment long after the departure line was declared clear.",
      followUp: (thread, trace) =>
        trace
          ? `The destination board still fails back to ${thread.sourceSessionLabel || trace.sessionLabel}. One compartment remains unresolved.`
          : `The train still insists someone never fully disembarked.`,
    },
    "platform-rails": {
      title: "Crossing Pattern",
      summary: ({ pattern }) =>
        `Residual current and recent footsteps suggest someone crossed the live rails after shutdown. The route reads like ${pattern.toLowerCase()} intent.`,
      lead: () =>
        "The crossing reaches toward the deeper wing, but the return path does not resolve.",
      followUp: () =>
        "The rails still imply traffic toward quarantine. Whatever crossed did not use the same logic on the way back.",
    },
    "quarantine-panel": {
      title: "Corroboration Request",
      summary: ({ trace }) =>
        trace
          ? `The quarantine panel has assembled an authorization problem around ${trace.sessionLabel} and now distrusts single-voice claims.`
          : `The quarantine panel has turned one locked door into a procedural problem with no clean single-user answer.`,
      lead: ({ trace }) =>
        trace
          ? `It keeps asking for a second confirming trace as if ${trace.sessionLabel} is still partially valid.`
          : "The gate appears willing to accept a second voice, a second trace, or a lie convincing enough to simulate one.",
      followUp: () =>
        "The panel still rejects solitary certainty. It is learning how to distrust anyone who arrives alone.",
    },
    "quarantine-listen": {
      title: "Delayed Occupant",
      summary: ({ trace }) =>
        trace
          ? `Movement beyond the quarantine gate suggests an occupant, residue, or active process still orienting itself around ${trace.sessionLabel}.`
          : "Movement beyond the quarantine gate suggests something is still choosing when to answer from the other side.",
      lead: () =>
        "Whatever is beyond the door only moves after you stop speaking.",
      followUp: () =>
        "The delayed movement persists. Something beyond the gate is letting silence choose the timing.",
    },
  };

  return configs[hookId] || null;
}

function spawnStoryThread(hookId) {
  if (!state.memory) {
    return [];
  }

  const config = getStoryHookConfig(hookId);
  if (!config) {
    return [];
  }

  const sessionLabel = state.currentSession?.sessionLabel || "";
  const trace = getPriorWorldTrace();
  const pattern = describePattern();
  const now = new Date().toISOString();
  const existing = state.memory.storyThreads.find((item) => item.hookId === hookId);

  if (existing) {
    existing.updatedAt = now;
    existing.sessionLabel = sessionLabel;
    existing.pattern = pattern;
    persistMemory();
    updateMemoryPreview();
    return [
      `Thread active // ${existing.title}.`,
      config.followUp(existing, trace, pattern),
    ];
  }

  const nextIndex = state.memory.storyThreads.length + 1;
  const thread = {
    id: `THREAD ${String(nextIndex).padStart(3, "0")}`,
    hookId,
    title: config.title,
    summary: config.summary({ trace, pattern, sessionLabel }),
    lead: config.lead({ trace, pattern, sessionLabel }),
    scene: state.currentScene || "",
    sessionLabel,
    sourceSessionLabel: trace?.sessionLabel || "",
    pattern,
    createdAt: now,
    updatedAt: now,
  };

  state.memory.storyThreads.unshift(thread);
  state.memory.storyThreads = state.memory.storyThreads.slice(0, 10);
  createCase(thread.title, thread.summary);
  persistMemory();
  updateMemoryPreview();

  return [
    `Case born // ${thread.title}.`,
    thread.summary,
    thread.lead,
  ];
}

function createWorldTrace(sourceTitle, summary) {
  if (!state.memory || !state.currentSession?.sessionLabel) {
    return;
  }

  const trace = {
    id: `TRACE-${Date.now()}`,
    sessionLabel: state.currentSession.sessionLabel,
    contactId: state.memory.contactId || "",
    sourceTitle,
    summary,
    pattern: describePattern(),
    clue: buildTraceClue(sourceTitle, summary, describePattern()),
    createdAt: new Date().toISOString(),
  };

  state.memory.worldTraces.unshift(trace);
  state.memory.worldTraces = state.memory.worldTraces.slice(0, 18);
  persistMemory();
}

function buildTraceClue(sourceTitle, summary, pattern) {
  if (sourceTitle === "Authority Conflict") {
    return `Stability routines persisted after ${pattern.toLowerCase()} input.`;
  }

  if (sourceTitle === "Disclosure Problem") {
    return `A truth filter remained active long after the speaker left.`;
  }

  if (sourceTitle === "Triage Decision") {
    return `Priority rankings kept running even after the room was empty.`;
  }

  return summary || `${pattern} residue detected.`;
}

function getPriorWorldTrace() {
  if (!state.memory?.worldTraces?.length) {
    return null;
  }

  return (
    state.memory.worldTraces.find(
      (trace) => trace.sessionLabel && trace.sessionLabel !== state.currentSession?.sessionLabel
    ) || state.memory.worldTraces[0]
  );
}

function getTraceClueLine(context) {
  const trace = getPriorWorldTrace();
  if (!trace) {
    return "";
  }

  switch (context) {
    case "map":
      return `A red annotation flickers and disappears: ${trace.sessionLabel} // ${trace.clue}`;
    case "door":
      return `A maintenance stamp is half-scrubbed from the panel: ${trace.sessionLabel}. Someone kept this mechanism cycling after they should have stopped.`;
    case "look":
      return `A trace keeps surfacing at the edge of the room: ${trace.sessionLabel}. The district still remembers one of its older answers.`;
    case "archive":
      return `Residual activity remains associated with ${trace.sessionLabel}.`;
    default:
      return `${trace.sessionLabel} still appears in the district logs.`;
  }
}

function updateMemoryPreview() {
  updateIdentityPanel();
  if (!state.memory || !state.memory.contactAssigned) {
    contactIdValue.textContent = "No contact assigned yet.";
    casePreview.textContent = "No cases recorded.";
    return;
  }

  contactIdValue.textContent =
    `${state.memory.contactId}\nCurrent session: ${state.currentSession?.sessionLabel || "Unassigned"}\nSessions: ${state.memory.sessions}\nLast pattern: ${state.memory.lastPattern}` +
    `${state.memory.selfLabel ? `\nSelf-label: ${state.memory.selfLabel}` : ""}`;

  if (!state.memory.cases.length) {
    casePreview.textContent = state.memory.storyThreads.length
      ? [
          "No cases recorded.",
          "",
          "Story Threads",
          ...state.memory.storyThreads.map(
            (item) =>
              `${item.id} // ${item.title}${item.sessionLabel ? ` // ${item.sessionLabel}` : ""}\n${item.summary}`
          ),
        ].join("\n")
      : "No cases recorded.";
    return;
  }

  const caseLines = state.memory.cases
    .map((item) => `${item.id} // ${item.title}${item.sessionLabel ? ` // ${item.sessionLabel}` : ""}\n${item.summary}`)
    .join("\n\n");
  const threadLines = state.memory.storyThreads.length
    ? [
        "",
        "Story Threads",
        ...state.memory.storyThreads.map(
          (item) =>
            `${item.id} // ${item.title}${item.sessionLabel ? ` // ${item.sessionLabel}` : ""}\n${item.summary}`
        ),
      ].join("\n\n")
    : "";

  casePreview.textContent = `${caseLines}${threadLines}`;
}

function createSessionRecord() {
  const record = {
    id: `SESSION-${Date.now()}`,
    startedAt: new Date().toISOString(),
    contactId: state.memory?.contactId || "",
    threadKey: state.threadKey,
    contactToken: getOrCreateContactToken(),
    selfLabel: state.memory?.selfLabel || "",
    invite: state.invitationSeed,
    mode: state.mode,
    channel: state.channel,
    events: [],
  };

  record.sessionNumber = getCurrentSessionNumber();
  record.sessionLabel = formatSessionLabel(record.contactId, record.sessionNumber);
  return record;
}

function recordSessionEvent(role, text) {
  if (!state.currentSession) {
    return;
  }

  syncCurrentSessionIdentity();
  state.currentSession.lastPattern = describePattern();
  state.currentSession.events.push({
    at: new Date().toISOString(),
    role,
    text,
  });
  state.currentSession.events = state.currentSession.events.slice(-120);
  persistMemory();
  updateSessionPreview();
  syncSessionRemote();
}

function updateSessionPreview() {
  if (!state.currentSession || state.currentSession.events.length === 0) {
    sessionPreview.textContent = "No session events yet.";
    return;
  }

  const recent = state.currentSession.events.slice(-6);
  sessionPreview.textContent = [
    `${state.currentSession.sessionLabel || state.currentSession.id}`,
    "",
    ...recent
    .map((event) => `${event.role.toUpperCase()} // ${event.text}`)
  ].join("\n\n");
}

function downloadSession(kind) {
  if (!state.currentSession) {
    return;
  }

  const baseName = `${(state.currentSession.sessionLabel || state.currentSession.id).toLowerCase().replace(/\s+/g, "-")}`;
  let content = "";
  let filename = "";
  let mime = "";

  if (kind === "json") {
    content = JSON.stringify(state.currentSession, null, 2);
    filename = `${baseName}.json`;
    mime = "application/json";
  } else {
    content = buildTranscriptText();
    filename = `${baseName}.txt`;
    mime = "text/plain";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildTranscriptText() {
  const header = [
    `Thread Key: ${state.threadKey}`,
    `Session Label: ${state.currentSession.sessionLabel || "Unassigned"}`,
    `Session: ${state.currentSession.id}`,
    `Started: ${state.currentSession.startedAt}`,
    `Contact: ${state.memory?.contactId || "Unassigned"}`,
    `Self-label: ${state.memory?.selfLabel || "None"}`,
    `Mode: ${state.mode}`,
    `Channel: ${state.channel}`,
    `Pattern: ${describePattern()}`,
    "",
  ];

  const body = state.currentSession.events.map(
    (event) => `[${event.at}] ${event.role.toUpperCase()}: ${event.text}`
  );

  return [...header, ...body].join("\n");
}

function getOrCreateContactToken() {
  try {
    const existing = window.localStorage.getItem(getTokenStorageKey());
    if (existing) {
      return existing;
    }

    const created = `contact:${state.threadKey.toLowerCase()}`;
    window.localStorage.setItem(getTokenStorageKey(), created);
    return created;
  } catch (error) {
    return `contact:${state.threadKey.toLowerCase()}`;
  }
}

async function initializeRemoteContact() {
  const token = getOrCreateContactToken();

  try {
    const response = await fetch(`${API_BASE}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactToken: token,
        selfLabel: state.memory?.selfLabel || "",
      }),
    });

    if (!response.ok) {
      state.remote.checked = true;
      return;
    }

    const data = await response.json();
    if (!data?.ok || !data.contactId) {
      state.remote.checked = true;
      return;
    }

    state.remote.available = true;
    state.remote.checked = true;
    state.memory.contactAssigned = true;
    state.memory.contactId = data.contactId;
    state.memory.sessions = data.sessions || state.memory.sessions || 1;
    syncCurrentSessionIdentity();
    persistMemory();
    updateMemoryPreview();

    // Load cross-session character history from KV
    try {
      const charResp = await fetch(
        `${API_BASE}/character?contactToken=${encodeURIComponent(token)}`
      );
      if (charResp.ok) {
        const charData = await charResp.json();
        if (charData.ok && charData.profile) {
          state.characterHistory = charData.profile;

          // Surface unread legacy idle events (NPC-style world events)
          const unread = (charData.profile.idleEvents || []).filter((e) => !e.read);
          if (unread.length) {
            state.pendingIdleEvents = unread;
          }

          // Surface active (unseen or unresolved) Echo Quests — personal problems from the shadow self
          const activeQuests = (charData.profile.echoQuests || []).filter((q) => !q.resolved);
          if (activeQuests.length) {
            state.pendingEchoQuests = activeQuests;
            notifyEchoQuests(activeQuests);
          }
        }
      }
    } catch (e) {
      // Character history is enhancement-only; ignore failures.
    }
  } catch (error) {
    state.remote.checked = true;
  }
}

/**
 * When the player returns to find active Echo Quests, surface a brief notice
 * before their session begins. Terse and ominous — just enough to signal that
 * something happened. The AI will surface the details in narrative.
 */
function notifyEchoQuests(quests) {
  const unseenQuests = quests.filter((q) => !q.seen);
  if (!unseenQuests.length) return; // Only show notice for new (unseen) quests

  const crisis = unseenQuests.filter((q) => q.severity === "catastrophic" || q.severity === "critical");
  const serious = unseenQuests.filter((q) => q.severity === "heavy");
  const needsAlly = unseenQuests.filter((q) => q.allyNeeded);

  window.setTimeout(() => {
    addMessage("echo", unseenQuests.length === 1
      ? "// ECHO ACTIVITY DETECTED DURING YOUR ABSENCE"
      : `// ECHO ACTIVITY DETECTED — ${unseenQuests.length} INCIDENTS LOGGED`
    );

    window.setTimeout(() => {
      addMessage("echo", "Your shadow did not wait for you.");
    }, 700);

    let delay = 1500;
    if (crisis.length) {
      window.setTimeout(() => {
        addMessage("echo", crisis.length === 1
          ? "One of the incidents is critical. The damage may already be irreversible."
          : `${crisis.length} incidents classified critical. The damage is already spreading.`
        );
      }, delay);
      delay += 900;
    } else if (serious.length) {
      window.setTimeout(() => {
        addMessage("echo", "What it left behind is serious. You have work to do.");
      }, delay);
      delay += 900;
    }

    if (needsAlly.length) {
      window.setTimeout(() => {
        addMessage("echo", "Some of what it started is too big to handle alone. You may need to find someone.");
      }, delay);
    }
  }, 900);
}

async function fetchWorldState() {
  try {
    const response = await fetch(`${API_BASE}/world-state`);
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.worldState) {
        state.worldState = data.worldState;
      }
    }
  } catch (e) {
    // World state is enhancement-only; ignore failures.
  }
}

async function submitTally(key) {
  const token = getOrCreateContactToken();
  try {
    fetch(`${API_BASE}/world-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tally", key, contactToken: token }),
    }).catch(() => {});
  } catch (e) {
    // Fire-and-forget; ignore failures.
  }
}

async function syncSessionRemote() {
  if (!state.remote.available || !state.currentSession) {
    return;
  }

  try {
    await fetch(`${API_BASE}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactToken: getOrCreateContactToken(),
        session: state.currentSession,
      }),
      keepalive: true,
    });
  } catch (error) {
    // Local-first prototype: ignore remote sync failures.
  }
}

async function persistResolvedEchoQuests(resolvedIds) {
  if (!state.remote.available || !resolvedIds?.length) return;
  const token = getOrCreateContactToken();
  try {
    await fetch(`${API_BASE}/character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactToken: token, resolvedQuestIds: resolvedIds }),
      keepalive: true,
    });
  } catch (e) {
    // Enhancement-only; ignore failures.
  }
}

async function saveCharacterHistory() {
  if (!state.remote.available || !state.memory.contactId) {
    return;
  }

  const token = getOrCreateContactToken();
  const allDecisions = state.memory.keyDecisions || [];
  const newDecisionCount = Math.max(0, allDecisions.length - state.decisionsAtSessionStart);
  // keyDecisions is prepended so newest are at the front
  const newDecisions = allDecisions.slice(0, newDecisionCount);

  const sessionSummary = buildSessionSummary();

  try {
    await fetch(`${API_BASE}/character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactToken: token,
        contactId: state.memory.contactId,
        sessionSummary,
        newDecisions,
      }),
      keepalive: true,
    });
  } catch (e) {
    // Enhancement-only; ignore failures.
  }
}

function buildSessionSummary() {
  if (!state.currentSession) {
    return null;
  }

  const sessionLabel = state.currentSession.sessionLabel || "";
  const casesThisSession = (state.memory.cases || [])
    .filter((c) => !sessionLabel || c.sessionLabel === sessionLabel)
    .map((c) => c.title)
    .slice(0, 4);

  const sceneName = {
    undertow: "Clinic Block C",
    relay: "Relay Shelter",
    junction: "Service Junction",
    platform: "Flooded Platform",
    quarantine: "Quarantine Gate",
  }[state.currentScene] || null;

  const parts = [
    sceneName ? `Reached ${sceneName}.` : "Did not enter the city.",
    casesThisSession.length ? `Cases: ${casesThisSession.join(", ")}.` : "",
    state.memory.storyArc || "",
  ].filter(Boolean);

  return {
    number: state.currentSession.sessionNumber || state.memory.sessions,
    sessionId: state.currentSession.id,
    summary: parts.join(" ") || "Session completed.",
    arc: state.memory.storyArc || "",
    tone: state.memory.dominantTone || "",
  };
}

// ─────────────────────────────────────────────────────────────
// AUDIO CONTROLS — wire up mute toggle and volume slider
// Audio engine (audio.js) starts on first chat submission.
// ─────────────────────────────────────────────────────────────

function initAudioControls() {
  const muteBtn = document.querySelector("#audioMute");
  const volSlider = document.querySelector("#audioVolume");
  const ae = window.audioEngine;

  if (!ae) return;

  // Show reduced controls on mobile (engine won't start there without opt-in)
  if (ae.isMobile && muteBtn) {
    muteBtn.textContent = "◈ Sound (off)";
    muteBtn.title = "Tap to enable ambient sound";
    muteBtn.addEventListener("click", () => {
      ae.start();
      ae.update(state);
      muteBtn.textContent = "◈ Sound";
      muteBtn.classList.remove("audio-off");
    });
    return;
  }

  muteBtn?.addEventListener("click", () => {
    // Start on first click if not yet started
    if (!ae.started) ae.start();

    const nowMuted = ae.toggleMute();
    muteBtn.textContent = nowMuted ? "◈ Muted" : "◈ Sound";
    muteBtn.classList.toggle("audio-off", nowMuted);
  });

  volSlider?.addEventListener("input", () => {
    if (!ae.started) ae.start();
    ae.setVolume(parseFloat(volSlider.value));
    // Un-mute when user drags volume
    if (ae.muted) {
      ae.toggleMute();
      const muteB = document.querySelector("#audioMute");
      if (muteB) { muteB.textContent = "◈ Sound"; muteB.classList.remove("audio-off"); }
    }
  });
}
