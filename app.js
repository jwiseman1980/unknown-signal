const conversationEl = document.querySelector("#conversation");
const chatForm = document.querySelector("#chatForm");
const playerInput = document.querySelector("#playerInput");
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
  triageCompleted: false,
  storageKey: "unknown-signal-memory-v1",
  memory: null,
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
  inviteMessage.textContent = state.invitationSeed;
  signalInput.value = state.invitationSeed;
  contactMode.value = state.mode;
  channelMode.value = state.channel;
  devPanel.classList.toggle("hidden", !state.devMode);

  syncShareTargets();
  updateInsights();
  updateMemoryPreview();
  persistMemory();
  setupSpeechRecognition();
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
    voiceToggle.textContent = state.voiceEnabled ? "Voice Ready" : "Enable Voice";
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
  if (!state.triageCompleted) {
    startTriageSimulation();
    return;
  }

  const pattern = describePattern();
  createCase("Undertow Intake", `Clinic Block C / ${pattern}`);
  undertowSummary.textContent =
    `Recovery chamber unlocked. Clinic Block C is half-flooded and losing power. ` +
    `Something in the city has already marked you as ${pattern.toLowerCase()}. ` +
    `Mara is bleeding behind a divider. Iven is trying not to panic. ` +
    `Something metallic is scraping at the clinic door.`;
  undertowPanel.classList.remove("hidden");
  addMessage("echo", "You are not in the city yet. This is only contact.");
  addMessage("echo", "Placement confirmed. Undertow. Clinic Block C.");
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
    : buildEchoReply(text, fromVoice);
  for (const reply of replies) {
    addMessage("echo", reply);
    if (fromVoice) {
      speak(reply);
    }
  }

  if (state.interactionCount >= 3 && !state.voiceEnabled) {
    voiceToggle.classList.remove("hidden");
  }

  if (state.interactionCount >= 4) {
    refreshTransitionPanel();
  }
}

function addMessage(role, text) {
  state.messages.push({ role, text });

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
  } else if (hasOneOf(normalized, ["is this a game"])) {
    replies.push("Not if you answer honestly.");
  } else if (hasOneOf(normalized, ["nothing", "fine"])) {
    replies.push("Incorrect.");
    replies.push("But that answer is common.");
  } else if (hasOneOf(normalized, ["trust", "everything"])) {
    replies.push("Non-physical injury acknowledged.");
    replies.push("You brought the larger pain early.");
  } else if (hasOneOf(normalized, ["my arm", "my head", "my chest"])) {
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

  if (state.interactionCount === 3 && !state.voiceEnabled) {
    replies.push("Typing introduces revision.");
    replies.push("Revision introduces distance.");
    replies.push("If you want to continue, let me hear you.");
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
  if (state.activeSimulation) {
    transitionPanel.classList.add("hidden");
    return;
  }

  if (state.triageCompleted) {
    transitionCopy.textContent =
      "Case recorded. The city is available now if you want to continue.";
    placeMe.textContent = "Continue To Undertow";
    transitionPanel.classList.remove("hidden");
    return;
  }

  transitionCopy.textContent =
    "A simulation is available. The signal wants help with a decision it cannot resolve cleanly.";
  placeMe.textContent = "Begin Triage Simulation";
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

function startTriageSimulation() {
  if (state.activeSimulation) {
    return;
  }

  state.activeSimulation = {
    id: "triage",
    stage: "choice",
    choice: "",
  };

  createCase("Triage Decision", "Awaiting release order");
  transitionPanel.classList.add("hidden");

  addMessage("echo", "Simulation available.");
  addMessage(
    "echo",
    "A station breach has left two people sealed in separate compartments."
  );
  addMessage(
    "echo",
    "Reserve power can release one door immediately. The second door may not cycle in time."
  );
  addMessage("echo", "Choose the release order.");
}

function handleSimulationInput(text) {
  const normalized = text.toLowerCase();
  const sim = state.activeSimulation;

  if (!sim || sim.id !== "triage") {
    return ["The signal lost the shape of that simulation.", "Begin again."];
  }

  if (sim.stage === "choice") {
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

  const resolution = resolveTriageFollowup(normalized, sim.choice);
  state.activeSimulation = null;
  state.triageCompleted = true;
  createCase("Triage Decision", resolution.caseSummary);
  refreshTransitionPanel();
  return resolution.lines;
}

function isChoiceForA(text) {
  return hasOneOf(text, [
    "compartment a",
    "release a",
    "open a",
    "save a",
    "a first",
    "first a",
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
