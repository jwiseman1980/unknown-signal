const conversationEl = document.querySelector("#conversation");
const chatForm = document.querySelector("#chatForm");
const playerInput = document.querySelector("#playerInput");
const submitButton = chatForm.querySelector('button[type="submit"]');
const voiceToggle = document.querySelector("#voiceToggle");
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
const undertowSummary = document.querySelector("#undertowSummary");
const API_BASE = "/api";

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
    mapChecked: false,
    doorChecked: false,
  },
  storageKey: "unknown-signal-memory-v1",
  tokenStorageKey: "unknown-signal-contact-token-v1",
  memory: null,
  currentSession: null,
  remote: {
    available: false,
    checked: false,
  },
  echoQueue: Promise.resolve(),
  traits: {
    guarded: 0,
    confessional: 0,
    controlling: 0,
    curious: 0,
    performative: 0,
    vulnerable: 0,
  },
  attention: 0,
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
    title: "Triage Decision",
    button: "Begin Triage Simulation",
    prompt:
      "A simulation is available. The signal wants help with a triage decision it cannot resolve cleanly.",
  },
  disclosure: {
    title: "Disclosure Problem",
    button: "Begin Disclosure Simulation",
    prompt:
      "A simulation is available. The signal wants help with a truth problem it cannot resolve cleanly.",
  },
  authority: {
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

function boot() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const seed = params.get("signal");
  const channel = params.get("channel");
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
  setupSpeechRecognition();
  initializeRemoteContact();
  queueIntro();
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

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
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

  const replies = state.activeSimulation
    ? handleSimulationInput(text)
    : state.currentScene === "undertow"
      ? handleUndertowInput(text)
    : buildEchoReply(text, fromVoice);
  queueEchoReplies(replies, fromVoice);

  if (state.interactionCount >= 5 && !state.voiceEnabled) {
    voiceToggle.classList.remove("hidden");
  }

  if (state.interactionCount >= 4) {
    refreshTransitionPanel();
  }
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
  body.textContent = text;

  message.append(meta, body);
  conversationEl.appendChild(message);
  conversationEl.scrollTop = conversationEl.scrollHeight;
  idleIndicator.classList.add("hidden");
}

function queueEchoReplies(replies, fromVoice) {
  setComposerEnabled(false);
  idleIndicator.classList.remove("hidden");

  let delay = 120;
  state.echoQueue = state.echoQueue.then(
    () =>
      new Promise((resolve) => {
        for (const reply of replies) {
          window.setTimeout(() => {
            addMessage("echo", reply);
            if (fromVoice) {
              speak(reply);
            }
          }, delay);
          delay += getEchoDelay(reply);
        }

        window.setTimeout(() => {
          idleIndicator.classList.add("hidden");
          setComposerEnabled(true);
          resolve();
        }, delay);
      })
  );
}

function getEchoDelay(text) {
  return Math.min(1050, Math.max(320, 180 + text.length * 11));
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
  const normalized = text.toLowerCase();
  const replies = [];

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

  if (state.askedWhatHurts && hasOneOf(normalized, ["what do you mean", "what does that mean"])) {
    replies.push("Body. Memory. Trust. Pride.");
    replies.push("Start with the answer that costs the least to say out loud.");
    return replies;
  }

  if (
    state.memory?.cases?.length &&
    hasOneOf(normalized, ["retrieve", "retreive", "retrieve cases", "show cases", "show archive", "archive"])
  ) {
    const recentCases = state.memory.cases.slice(-2).map((item) => `${item.id} // ${item.title}`);
    replies.push("Archived cases retrieved.");
    replies.push(...recentCases);
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
  if (state.activeSimulation || state.currentScene === "undertow") {
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
  if (!synth) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.88;
  synth.cancel();
  synth.speak(utterance);
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
      }, 700);
    }
    chatForm.classList.remove("hidden");
    playerInput.focus();
  }, 1800);
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
  state.activeSimulation = {
    id: state.openingSimulationId,
    stage: "choice",
    choice: "",
  };

  createCase(simulation.title, "Awaiting first decision");
  transitionPanel.classList.add("hidden");

  addMessage("echo", "Simulation available.");

  if (simulation.id === "triage") {
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

  if (simulation.id === "disclosure") {
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
  createCase(title, caseSummary);
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

function enterUndertow() {
  if (state.currentScene === "undertow") {
    return;
  }

  const pattern = describePattern();
  state.currentScene = "undertow";
  createCase("Undertow Intake", `Clinic Block C / ${pattern}`);
  undertowSummary.textContent =
    `Recovery chamber unlocked. Clinic Block C is half-flooded and losing power. ` +
    `Something in the city has already marked you as ${pattern.toLowerCase()}. ` +
    `Mara is bleeding behind a divider. Iven is trying not to panic. ` +
    `Something metallic is scraping at the clinic door.`;
  undertowPanel.classList.remove("hidden");
  transitionPanel.classList.add("hidden");
  addMessage("echo", "Placement confirmed. Undertow. Clinic Block C.");
  addMessage(
    "echo",
    "You can inspect the door, open the divider, take the medkit, or check the map."
  );
}

function handleUndertowInput(text) {
  const normalized = text.toLowerCase();

  if (hasOneOf(normalized, ["where am i", "where am i?", "location", "what is this place", "what is this"])) {
    return [
      "Clinic Block C, Undertow District.",
      "Flooded transit-and-triage infrastructure below the city.",
      "Power is unstable. The room is not secure.",
    ];
  }

  if (hasOneOf(normalized, ["what do i do", "what next", "help", "options", "what can i do"])) {
    return [
      "Immediate options remain limited and unpleasant.",
      "Inspect the door. Open the divider. Take the medkit. Check the map.",
    ];
  }

  if (hasOneOf(normalized, ["door", "what's at the door", "whats at the door", "check door", "inspect door"])) {
    state.sceneState.doorChecked = true;
    return [
      "The scraping is slow and metallic, like a maintenance frame dragging damaged equipment.",
      "It does not sound rushed. It sounds patient.",
    ];
  }

  if (hasOneOf(normalized, ["divider", "open divider", "behind divider", "check divider"])) {
    state.sceneState.dividerOpened = true;
    return [
      "Behind the divider is Mara Vale, wounded but conscious, with a stripped med rig and very little patience left.",
      "Somewhere lower, someone else is breathing too fast and trying not to panic.",
    ];
  }

  if (hasOneOf(normalized, ["medkit", "take medkit", "grab medkit"])) {
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
    return [
      "The station map flickers: Clinic Block C, flooded rail line, quarantine access, service corridor.",
      "One route is marked in red and keeps disappearing before you can fully read it.",
    ];
  }

  if (hasOneOf(normalized, ["talk to mara", "mara"])) {
    return [
      "Mara looks at you like you are late and immediately useful.",
      "\"If you can stand, then help. If you can't, stay out of my way.\"",
    ];
  }

  if (hasOneOf(normalized, ["look", "look around", "survey room"])) {
    return [
      "Cold light. Shallow water. A sealed clinic door. A divider hiding the wounded. A wall medkit. A flickering map.",
      "The room was built to keep people alive long enough to be processed.",
    ];
  }

  return [
    "The room is still waiting on a practical choice.",
    "Door, divider, medkit, or map.",
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
  return shareUrl.toString();
}

function getSharePayload() {
  return channelConfig[state.channel].format(state.invitationSeed, getShareUrl());
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
  };

  try {
    const raw = window.localStorage.getItem(state.storageKey);
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
    };
  } catch (error) {
    return fallback;
  }
}

function persistMemory() {
  if (!state.memory) {
    return;
  }

  state.memory.lastPattern = describePattern();
  state.memory.lastInvite = state.invitationSeed;
  state.memory.currentSessionId = state.currentSession?.id || "";

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
    window.localStorage.setItem(state.storageKey, JSON.stringify(state.memory));
  } catch (error) {
    // Ignore storage failures in the prototype.
  }
}

function assignContactId() {
  state.memory.contactAssigned = true;
  state.memory.contactId = generateContactId();
  state.memory.sessions += 1;
  addMessage("echo", "contact established");
  addMessage("echo", `provisional id: ${state.memory.contactId}`);
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

  if (existing) {
    existing.summary = summary;
    existing.updatedAt = new Date().toISOString();
  } else {
    const nextIndex = state.memory.cases.length + 1;
    state.memory.cases.unshift({
      id: `CASE ${String(nextIndex).padStart(3, "0")}`,
      title,
      summary,
      updatedAt: new Date().toISOString(),
    });
  }

  state.memory.cases = state.memory.cases.slice(0, 6);
  persistMemory();
  updateMemoryPreview();
}

function updateMemoryPreview() {
  if (!state.memory || !state.memory.contactAssigned) {
    contactIdValue.textContent = "No contact assigned yet.";
    casePreview.textContent = "No cases recorded.";
    return;
  }

  contactIdValue.textContent =
    `${state.memory.contactId}\nSessions: ${state.memory.sessions}\nLast pattern: ${state.memory.lastPattern}` +
    `${state.memory.selfLabel ? `\nSelf-label: ${state.memory.selfLabel}` : ""}`;

  if (!state.memory.cases.length) {
    casePreview.textContent = "No cases recorded.";
    return;
  }

  casePreview.textContent = state.memory.cases
    .map((item) => `${item.id} // ${item.title}\n${item.summary}`)
    .join("\n\n");
}

function createSessionRecord() {
  return {
    id: `SESSION-${Date.now()}`,
    startedAt: new Date().toISOString(),
    contactId: state.memory?.contactId || "",
    contactToken: getOrCreateContactToken(),
    selfLabel: state.memory?.selfLabel || "",
    invite: state.invitationSeed,
    mode: state.mode,
    channel: state.channel,
    events: [],
  };
}

function recordSessionEvent(role, text) {
  if (!state.currentSession) {
    return;
  }

  state.currentSession.contactId = state.memory?.contactId || "";
  state.currentSession.selfLabel = state.memory?.selfLabel || "";
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
  sessionPreview.textContent = recent
    .map((event) => `${event.role.toUpperCase()} // ${event.text}`)
    .join("\n\n");
}

function downloadSession(kind) {
  if (!state.currentSession) {
    return;
  }

  const baseName = `${state.currentSession.id.toLowerCase()}`;
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
    const existing = window.localStorage.getItem(state.tokenStorageKey);
    if (existing) {
      return existing;
    }

    const created =
      window.crypto?.randomUUID?.() ||
      `token-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    window.localStorage.setItem(state.tokenStorageKey, created);
    return created;
  } catch (error) {
    return `token-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
    persistMemory();
    updateMemoryPreview();
  } catch (error) {
    state.remote.checked = true;
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
