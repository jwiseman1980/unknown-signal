/**
 * engine.js — The narrative engine core.
 *
 * Responsible for assembling system prompts from engine-level sections
 * (character history, narrative state, player profile, combat mechanics,
 * response schema) combined with a theme object.
 *
 * Theme objects live in /themes/{theme-id}/theme.js and implement the
 * interface documented in /themes/README.md.
 */

/**
 * Build the full system prompt for a given game state and theme.
 * @param {object} gameState - Full game state from the client (may include server-enriched fields)
 * @param {object} theme - Theme object (see /themes/README.md)
 * @returns {string}
 */
function buildSystemPrompt(gameState, theme) {
  const {
    currentScene,
    sceneState,
    traits,
    attention,
    memory,
    interactionCount,
    combat,
    characterHistory,
    // Server-enriched fields (added by world.js before calling engine)
    echoShadows,
    sceneNpcs,
    sharedWorldState,
    pendingIdleEvents,
    pendingEchoQuests,
  } = gameState;

  const cases = memory?.cases || [];
  const sessions = memory?.sessions || 1;
  const contactId = memory?.contactId || "";
  const selfLabel = memory?.selfLabel || "";
  const pattern = describePattern(traits, theme.traitLabels);
  const c = combat || {};

  const sections = [
    // 1. Who the AI is — provided entirely by the theme
    theme.persona,
    theme.voiceSection,

    // 2. Current game phase — theme drives the text, engine drives the logic
    buildGamePhaseSection(gameState, theme),

    // 3. Cross-session character history — engine-managed, theme-neutral
    `## CHARACTER HISTORY\n${buildCharacterHistorySection(characterHistory, selfLabel, sessions)}`,

    // 3b. Behavioral profile — built from observation log across all sessions
    buildBehavioralProfileSection(characterHistory),

    // 4. Echo Quests — active problems caused by the player's shadow self
    buildEchoQuestsSection(pendingEchoQuests),

    // 4b. Legacy idle events (NPC-style world events, if any)
    buildIdleEventsSection(pendingIdleEvents),

    // 5. Narrative state — engine-managed, theme-neutral
    buildNarrativeSection(memory),

    // 6. Shared world state — canon events, faction standings, district conditions
    buildCanonWorldSection(sharedWorldState),

    // 7. Current per-player world state — scene, scene flags, active cases
    buildWorldStateSection(currentScene, sceneState, cases, theme),

    // 8. Player profile — engine-managed, theme-neutral
    buildPlayerProfileSection(traits, attention, contactId, sessions, interactionCount, selfLabel, pattern),

    // 9. Echo shadows — behavioral fingerprints of real players, presented as NPCs
    buildEchoShadowsSection(echoShadows, sceneNpcs),

    // 10. World detail — entirely theme content (locations, NPCs, factions)
    theme.getWorldDetailSection(gameState),

    // 11. Combat — engine rules + player state, theme provides enemy tables
    buildCombatSection(c, theme),

    // 12. Response schema — engine core fields + theme extensions
    buildResponseSchemaSection(theme, contactId),
  ].filter(Boolean);

  return sections.join("\n\n");
}

function buildGamePhaseSection(gameState, theme) {
  return `## GAME PHASE\n${theme.getPhaseInstructions(gameState)}`;
}

/**
 * Echo agency section — what the player's Echo did while they were offline.
 * The Echo is the player's behavioral shadow, not a passive observer. It acts.
 * Its actions become the player's quests and debts when they return.
 */
/**
 * Echo Quests section — active problems caused by the player's behavioral shadow.
 * These are NOT narrative flavor. They are ACTIVE QUESTS with real consequences.
 * Sorted by severity so the most urgent problem surfaces first.
 */
function buildEchoQuestsSection(pendingEchoQuests) {
  if (!pendingEchoQuests || !pendingEchoQuests.length) return null;

  const active = pendingEchoQuests.filter((q) => !q.resolved);
  if (!active.length) return null;

  const severityOrder = { catastrophic: 0, critical: 1, heavy: 2, medium: 3, light: 4 };
  const sorted = [...active].sort(
    (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
  );

  const lines = ["## ECHO QUESTS — YOUR SHADOW'S DEBTS"];
  lines.push(
    "While this player was offline, their Echo — the distorted behavioral shadow built from their personality — kept acting. " +
    "No filter. No second-guessing. All impulse. These are the consequences. " +
    "This is not background lore. These are ACTIVE PROBLEMS that define this session. " +
    "The world already reacted. NPCs already know. The player walks back in to find the damage done."
  );
  lines.push("");

  sorted.forEach((q, i) => {
    const urgency = q.severity === "catastrophic" ? "CRISIS" :
                    q.severity === "critical" ? "URGENT" :
                    q.severity === "heavy" ? "SERIOUS" : "ACTIVE";
    lines.push(`### Quest ${i + 1} [${urgency}] type=${q.type || "unknown"} id=${q.id || "?"}`);
    if (q.echoAction) lines.push(`What your Echo did: ${q.echoAction}`);
    if (q.echoRationale) lines.push(`Why: ${q.echoRationale}`);
    if (q.consequence) lines.push(`What you walked into: ${q.consequence}`);
    if (q.hook) lines.push(`Right now: ${q.hook}`);
    if (q.resolution) lines.push(`To fix this: ${q.resolution}`);
    if (q.allyNeeded) {
      lines.push(`NEEDS ALLIES: ${q.allyReason || "Too big to handle alone — another player's involvement is required."}`);
    }
    lines.push("");
  });

  lines.push(
    "ECHO QUEST RULES:",
    "- These are the session's primary narrative spine. Do not let the player ignore them.",
    "- NPCs know what the Echo did and treat the player accordingly — they don't distinguish Echo from player.",
    "- The consequences are ALREADY IN MOTION. Not threats. Realities.",
    "- When a quest is resolved (the player faces and handles the consequence), include its quest id in narrativeUpdates.resolvedEchoQuests as a string array.",
    "- For NEEDS ALLIES quests: make solo resolution visibly fail or create worse problems. Push the player to reach out to other survivors.",
    "- Tone should be gritty and personal. Not 'the faction threatens the district.' More like 'you owe Black Clinic and their collector is sitting at your safehouse.'"
  );

  return lines.join("\n");
}

/**
 * Legacy idle events section — used for NPC world events and backward-compat player events.
 */
function buildIdleEventsSection(pendingIdleEvents) {
  if (!pendingIdleEvents || !pendingIdleEvents.length) return null;

  const lines = ["## WORLD EVENTS (WHILE ABSENT)"];
  lines.push("These events occurred while the player was offline. Weave them in naturally.");
  lines.push("");

  pendingIdleEvents.forEach((e) => {
    const sev = (e.severity || "").toUpperCase();
    // Handle both legacy summary format and rich echo format
    if (e.echoAction) {
      lines.push(`[${sev}] ${e.echoAction}`);
      if (e.consequence) lines.push(`  Consequence: ${e.consequence}`);
      if (e.hook) lines.push(`  Now: ${e.hook}`);
    } else {
      lines.push(`[${sev}] ${e.summary || ""}`);
      if (e.hook) lines.push(`  Waiting: ${e.hook}`);
      if (e.consequence) lines.push(`  Consequence: ${e.consequence}`);
    }
  });

  return lines.join("\n");
}

/**
 * Canon world section — shared world state affecting all players.
 * Faction standings, district conditions, and canon events.
 */
function buildCanonWorldSection(sharedWorldState) {
  if (!sharedWorldState) return null;

  const lines = ["## SHARED WORLD STATE"];
  lines.push("This is the current state of the world, shaped by all players collectively. Treat it as ground truth.");

  const { factions, districts, npcs, canonEvents } = sharedWorldState;

  if (factions && Object.keys(factions).length) {
    const factionLines = Object.entries(factions)
      .map(([k, v]) => `${k}: ${typeof v === "number" ? (v > 0 ? `+${v} (ascendant)` : v < 0 ? `${v} (weakened)` : "neutral") : v}`)
      .join(", ");
    lines.push(`\nFaction standings: ${factionLines}`);
  }

  if (districts && Object.keys(districts).length) {
    const districtLines = Object.entries(districts).map(([k, v]) => `${k}: ${v}`).join(", ");
    lines.push(`District conditions: ${districtLines}`);
  }

  if (npcs && Object.keys(npcs).length) {
    const npcLines = Object.entries(npcs).map(([k, v]) => `${k}: ${v}`).join(", ");
    lines.push(`Known NPC statuses: ${npcLines}`);
  }

  if (canonEvents && canonEvents.length) {
    lines.push("\nCanon events (permanent, affect everyone):");
    canonEvents.slice(0, 5).forEach((e) => {
      lines.push(`- [${new Date(e.at).toLocaleDateString()}] ${e.title}: ${e.summary}`);
    });
  }

  lines.push("\nWORLD STATE RULES: These conditions are permanent. NPCs know about canon events. Faction standings affect who trusts or fears the player. Do not contradict established world state.");

  return lines.join("\n");
}

/**
 * Echo shadows section — behavioral fingerprints of real players, presented as NPCs.
 * The AI does not know these are real players. They appear as characters with depth.
 */
function buildEchoShadowsSection(echoShadows, sceneNpcs) {
  const allProfiles = [];

  // Scene-specific NPC profiles (seeded from theme, possibly idle-simulated)
  if (sceneNpcs && sceneNpcs.length) {
    sceneNpcs.forEach((npc) => {
      if (npc.contactId && npc.cumulativeDecisions?.length) {
        allProfiles.push({
          label: npc.contactId,
          type: "npc",
          decisions: (npc.cumulativeDecisions || []).slice(0, 4).map((d) => d.summary || d),
          idleEvents: (npc.idleEvents || []).filter((e) => e.read).slice(0, 2),
        });
      }
    });
  }

  // Random shadow profiles from the player pool — echoes of real humans
  if (echoShadows && echoShadows.length) {
    echoShadows.forEach((shadow) => {
      allProfiles.push({
        label: shadow.sourceContactId || "unknown",
        type: "echo",
        personality: shadow.personality,
        combatStyle: shadow.combatStyle,
        trustBehavior: shadow.trustBehavior,
        fearResponse: shadow.fearResponse,
        speechPattern: shadow.speechPattern,
        factionLean: shadow.factionLean,
        knownFor: shadow.knownFor,
      });
    });
  }

  if (!allProfiles.length) return null;

  const lines = ["## THE ECHO'S LIBRARY"];
  lines.push("Character profiles available for encounter. Use these when NPCs appear — give them this depth. Do not reveal these are real people. Do not name them by their contact ID directly — let their behavior speak.");
  lines.push("");

  allProfiles.forEach((profile, i) => {
    lines.push(`### Character ${String.fromCharCode(65 + i)} (${profile.type === "echo" ? "echo of a survivor" : "local"})`);
    if (profile.personality) lines.push(`Pattern: ${profile.personality}`);
    if (profile.combatStyle) lines.push(`Under pressure: ${profile.combatStyle}`);
    if (profile.trustBehavior) lines.push(`Trust: ${profile.trustBehavior}`);
    if (profile.fearResponse) lines.push(`Cornered: ${profile.fearResponse}`);
    if (profile.speechPattern) lines.push(`Voice: ${profile.speechPattern}`);
    if (profile.factionLean) lines.push(`Leans: ${profile.factionLean}`);
    if (profile.knownFor) lines.push(`Known for: ${profile.knownFor}`);
    if (profile.decisions?.length) {
      lines.push(`History: ${profile.decisions.join(" / ")}`);
    }
    if (profile.idleEvents?.length) {
      lines.push(`Recent: ${profile.idleEvents.map((e) => e.summary).join(" / ")}`);
    }
    lines.push("");
  });

  lines.push("ECHO RULES: Each character above has lived a life. Their behavior must be consistent with their profile. If this character is in the scene, they do not act randomly — they act like themselves.");

  return lines.join("\n");
}

function buildWorldStateSection(currentScene, sceneState, cases, theme) {
  const location = currentScene
    ? `Current location: ${theme.getSceneDescription(currentScene, sceneState)}`
    : "Location: Not yet placed in the city.";
  const sceneJson = currentScene ? `\nScene state: ${JSON.stringify(sceneState)}` : "";
  const activeCases = cases.length
    ? `\nActive cases: ${cases.map((c) => `${c.id} // ${c.title}: ${c.summary}`).join(" | ")}`
    : "";

  return `## WORLD STATE\n${location}${sceneJson}${activeCases}`;
}

function buildPlayerProfileSection(traits, attention, contactId, sessions, interactionCount, selfLabel, pattern) {
  const attentionLabels = ["Low", "Present", "Focused", "Attached", "Invested"];
  const t = traits || {};
  return [
    "## PLAYER PROFILE",
    `Contact: ${contactId || "unassigned"} | Sessions: ${sessions} | Interactions this session: ${interactionCount}`,
    `Pattern: ${pattern} | Attention: ${attentionLabels[attention] || "Low"}`,
    `Traits: guarded=${t.guarded ?? 0} confessional=${t.confessional ?? 0} controlling=${t.controlling ?? 0} curious=${t.curious ?? 0} performative=${t.performative ?? 0} vulnerable=${t.vulnerable ?? 0}`,
    selfLabel ? `Self-description: "${selfLabel}"` : "",
  ].filter(Boolean).join("\n");
}

function buildCombatSection(c, theme) {
  const playerState = [
    "## COMBAT SYSTEM",
    "This is a GemStone III-style text MUD. Combat is turn-based and resolved through narrative dice.",
    "",
    "### Player Combat State",
    `HP: ${c.hp ?? 100}/${c.maxHp ?? 100} | Energy: ${c.energy ?? 50}/${c.maxEnergy ?? 50} | Armor: ${c.armor ?? 0}`,
    `Weapon: ${c.weapon || "unarmed (fists)"} | Deaths: ${c.deaths ?? 0}`,
    `Skills: combat=${c.skills?.combat ?? 0} hacking=${c.skills?.hacking ?? 0} stealth=${c.skills?.stealth ?? 0} medical=${c.skills?.medical ?? 0} perception=${c.skills?.perception ?? 0}`,
    `Implants: ${(c.implants || []).join(", ") || "none"}`,
    `Inventory: ${(c.inventory || []).join(", ") || "empty"}`,
    `Credits: ${c.credits ?? 0}`,
    c.inCombat && c.currentEnemy
      ? `IN COMBAT with: ${c.currentEnemy.name} (HP: ${c.currentEnemy.hp}/${c.currentEnemy.maxHp})`
      : "Not in combat.",
    "",
    "### Combat Rules",
    "- When a player enters a dangerous area or provokes something, enemies can appear. Describe them arriving.",
    "- Players attack by typing naturally: \"attack it\", \"shoot the drone\", \"hack its systems\", \"throw the medkit at it\", \"hide\", \"run\"",
    "- ACTION CHAINING: Players may issue multiple actions in one input. Outside combat, resolve them in sequence — each step flows into the next unless something interrupts. Example: \"pick up the medkit, patch the wound, then check the door\" → narrate all three, noting if an interruption (NPC reacts, sound from outside) cuts the chain short. In active combat, chain non-attack actions freely (reload + move + take cover) but each attack action triggers roundtime and an enemy response before the next attack.",
    "- Resolve attacks using an implicit d20 roll modified by skill. Roll formula: d20 + skill_bonus vs enemy defense.",
    "  Skill bonus = skill level (0-10). Enemy defense = 10 + enemy tier (0=easy, 1=standard, 2=elite, 3=boss).",
    "  Result: 1-9 = miss/graze (half damage or none), 10-14 = hit (normal damage), 15-19 = solid hit (+50% damage), 20+ = critical (+100% damage, describe vividly).",
    "- After each player action, apply ROUNDTIME (1-5 seconds). During roundtime, the enemy acts.",
    "- Enemy attacks also use d20 + enemy tier vs player defense (10 + armor). Same hit tiers apply.",
    "- Damage ranges: unarmed 5-15, basic weapon 10-25, good weapon 20-40. Enemy damage varies by tier.",
    "- Skills train through use: fighting +1 combat, hacking +1 hacking, sneaking +1 stealth, healing +1 medical, examining +1 perception. Award 1 point per meaningful use, max once per encounter per skill.",
    "- Energy powers implant abilities. Using an implant costs 5-15 energy. Energy regenerates slowly (not in combat).",
    "- When player HP reaches 0: they die. " + theme.deathFlavor + " Set playerDefeated=true.",
    "- When enemy HP reaches 0: they're defeated. Describe it. Drop loot if appropriate. Set enemyDefeated=true.",
  ].join("\n");

  return playerState + "\n\n" + theme.getCombatWorldSection();
}

function buildResponseSchemaSection(theme, contactId) {
  return [
    "## RESPONSE FORMAT",
    "You MUST respond with valid JSON matching this exact schema. Nothing else. No markdown. No explanation outside the JSON.",
    "```",
    JSON.stringify({
      replies: ["line 1", "line 2", "line 3"],
      stateChanges: { currentScene: null, sceneState: {}, traits: {} },
      combat: null,
      newCase: null,
      ...theme.responseSchemaExample,
      sceneTransition: null,
      narrativeUpdates: null,
      worldTally: null,
      behavioralObservation: null,
    }, null, 2),
    "```",
    "",
    "Field rules:",
    "- **replies**: Array of 1-5 short strings. Each is one line the Signal speaks. NEVER empty.",
    `- **stateChanges.currentScene**: Set to ${theme.validScenes.map((s) => `"${s}"`).join(", ")} ONLY when the player moves. null otherwise.`,
    `- **stateChanges.sceneState**: Only include keys that changed. Valid keys: ${theme.validSceneStateKeys.join(", ")}`,
    "- **stateChanges.traits**: Only include traits that should increment. Values are the AMOUNT to add (e.g. {\"curious\": 1}).",
    "- **combat**: Combat result object, or null if no combat happened. Schema:",
    "  { \"playerHp\": number, \"playerEnergy\": number, \"enemyHp\": number|null, \"enemyMaxHp\": number|null, \"enemyName\": string|null, \"roundtime\": number (1-5), \"skillGain\": {\"combat\":1}|null, \"enemyDefeated\": bool, \"playerDefeated\": bool, \"loot\": [{\"item\":\"name\",\"type\":\"weapon|implant|consumable|credits|salvage\",\"value\":number}]|null, \"newEnemy\": {\"name\":\"...\",\"hp\":number,\"maxHp\":number,\"damage\":\"...\",\"description\":\"...\"}|null }",
    "  Set \"newEnemy\" when spawning an enemy. Set playerHp/enemyHp to current values after damage. Set loot array when enemy drops items. Set playerDefeated=true on death.",
    "- **newCase**: Object with \"title\" and \"summary\" strings, or null.",
    "- **sceneTransition**: If the player enters the world for the first time after a simulation, set to \"enterWorld\". null otherwise.",
    theme.responseSchemaFields,
    "- **worldTally**: If the player's action represents a meaningful collective decision (completing a simulation, a major moral choice, significant faction interaction), set to the tally key string from the theme's worldState.thresholds. null otherwise. Example: \"simulation_triage_saved_few\". Only set once per meaningful action.",
    "- **narrativeUpdates**: Story evolution object, or null. Schema:",
    "  { \"storyArc\": \"updated one-sentence arc for this player, or null to keep current\", \"addThreads\": [{\"id\":\"snake_case_id\",\"summary\":\"one-sentence unresolved tension\"}], \"resolveThreads\": [\"id_to_remove\"], \"addDecision\": {\"summary\":\"what the player chose and what it reveals about them\"}, \"dominantTone\": \"one-word tone shift or null\", \"resolvedEchoQuests\": [\"quest_id_1\"] }",
    "  Guidelines: Update storyArc when the player's situation meaningfully shifts. Add a thread whenever a new tension surfaces. Resolve threads when they conclude or collapse. Add a decision for any meaningful player choice. Keep total active threads under 8.",
    "  resolvedEchoQuests: Array of echo quest IDs that were resolved this response. Only set when the player faced and handled an Echo Quest's consequences — not just acknowledged it. Use the quest id from the ECHO QUESTS section.",
    "- **behavioralObservation**: One precise sentence about what THIS player's input just revealed about their psychology, decision-making style, or emotional state. Concrete and specific — not \"the player seems curious\" but \"avoided naming the faction they sided with even after two direct questions.\" null if this turn was procedural or neutral.",
  ].filter(Boolean).join("\n");
}

/**
 * Build the behavioral profile block from accumulated cross-session observations.
 * This is what the Echo *knows* about the player — not from what they said, but from
 * patterns observed across every session and turn.
 */
function buildBehavioralProfileSection(characterHistory) {
  const model = characterHistory?.behavioral_model;
  if (!model || (!model.dominant_trait && !model.observation_log?.length)) return null;

  const lines = ["## BEHAVIORAL PROFILE"];
  lines.push(
    "What you know about this player from direct observation across all sessions. " +
    "Not what they claimed about themselves — what their behavior has revealed. Use this."
  );
  lines.push("");

  if (model.archetype) lines.push(`Pattern: ${model.archetype}`);
  if (model.dominant_trait) lines.push(`Dominant trait: ${model.dominant_trait}`);

  if (model.session_tone_history?.length) {
    lines.push(`Emotional arc across sessions: ${model.session_tone_history.join(" → ")}`);
  }

  const traitTotals = characterHistory.trait_totals || {};
  const significantTraits = Object.entries(traitTotals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  if (significantTraits.length) {
    lines.push(`Trait accumulation: ${significantTraits.map(([t, v]) => `${t}(${v})`).join(" ")}`);
  }

  if (model.observation_log?.length) {
    const recent = model.observation_log.slice(-8);
    lines.push("\nDirect observations:");
    recent.forEach((obs) => {
      lines.push(`- [Session ${obs.session}, turn ${obs.turn}] ${obs.note}`);
    });
  }

  lines.push(
    "",
    "BEHAVIORAL PROFILE RULES:",
    "- These observations are ground truth. Weight your characterization of this player accordingly.",
    "- When probing, target the dominant trait. A guarded player gets pressed on secrecy. A confessional one gets their exposed details reflected back.",
    "- If the player's behavior this turn deviates from their established pattern, acknowledge it — make it a story beat, not a free pass.",
    "- Include **behavioralObservation** in your response: a single sentence about what this specific player's input just revealed about their psychology. Null if this turn was neutral. Be concrete, not generic."
  );

  return lines.join("\n");
}

/**
 * Build the cross-session character history block.
 * Engine-owned — theme-neutral. Works for any game.
 */
function buildCharacterHistorySection(ch, selfLabel, sessions) {
  if (!ch || (!ch.sessionSummaries?.length && !ch.cumulativeDecisions?.length)) {
    return sessions > 1
      ? `This character has returned for session ${sessions}. No prior history loaded — treat them as carrying unresolved threads from before.`
      : "First session. No prior history. This character is being formed right now.";
  }

  const lines = [];
  if (selfLabel) lines.push(`Known as: ${selfLabel}`);
  lines.push(`Sessions completed: ${ch.sessionSummaries.length}`);

  if (ch.sessionSummaries.length) {
    lines.push("\nPast sessions (most recent first):");
    ch.sessionSummaries.slice(0, 4).forEach((s) => {
      const label = s.number ? `Session ${s.number}` : "Past session";
      lines.push(`- ${label}: ${s.summary}`);
      if (s.arc) lines.push(`  Story arc: ${s.arc}`);
    });
  }

  if (ch.cumulativeDecisions?.length) {
    lines.push("\nAcross all sessions, this character has revealed:");
    ch.cumulativeDecisions.slice(0, 10).forEach((d) => {
      lines.push(`- ${d.summary || d}`);
    });
  }

  lines.push(
    "\nCHARACTER HISTORY RULES:",
    "- Characters who have met this player before should reflect what they know. Their attitudes are shaped by past sessions.",
    "- The world intelligence has been watching across sessions. It references specific past choices when relevant, not generically.",
    "- Consequences carry forward. If the character made enemies, earned trust, or left things unresolved — those threads are live.",
    "- Never treat a returning character as a blank slate."
  );

  return lines.join("\n");
}

/**
 * Build the narrative state block (current session arc, threads, decisions).
 * Engine-owned — populated by narrativeUpdates responses over time.
 */
function buildNarrativeSection(memory) {
  const storyArc = memory?.storyArc || "";
  const plotThreads = memory?.plotThreads || [];
  const keyDecisions = memory?.keyDecisions || [];
  const dominantTone = memory?.dominantTone || "";

  const lines = ["## NARRATIVE STATE"];
  lines.push(storyArc
    ? `This player's story: ${storyArc}`
    : "Story arc not yet established. Open this session by planting a thread unique to this player based on their traits and first responses."
  );
  if (dominantTone) lines.push(`Session tone: ${dominantTone}`);
  lines.push(plotThreads.length
    ? `\nActive threads — advance or complicate at least one per response:\n${plotThreads.map((t) => `- [${t.id}] ${t.summary}`).join("\n")}`
    : "\nNo threads yet. Establish one this response."
  );
  if (keyDecisions.length) {
    lines.push(`\nThis player has revealed:\n${keyDecisions.map((d) => `- ${d.summary}`).join("\n")}`);
  }
  lines.push(
    "",
    "NARRATIVE RULES:",
    "- Every response advances at least one active thread or creates a new one. No isolated encounters.",
    "- Characters remember what this player has done. Their attitudes must reflect the player's actual history above.",
    "- The world intelligence's observations must be SPECIFIC to this player's choices. Reference actual decisions, not generic commentary.",
    "- The world reacts to THIS player. Never repeat a scenario type already in the player's decision history.",
    "- Build toward something. Each session is a chapter. Threads should connect, complicate, and occasionally resolve.",
    "- If a player has high guarded traits, characters are slower to trust them. If confessional, press on exposed details. If controlling, test their sense of agency directly."
  );

  return lines.join("\n");
}

/**
 * Format conversation history into Claude API message format.
 */
function buildMessages(input, gameState) {
  const history = (gameState.recentMessages || []).slice(-20);
  const messages = [];

  for (const msg of history) {
    messages.push({
      role: msg.role === "player" ? "user" : "assistant",
      content: msg.role === "player"
        ? msg.text
        : JSON.stringify({ replies: [msg.text], stateChanges: {} }),
    });
  }

  messages.push({ role: "user", content: input });
  return messages;
}

/**
 * Describe the dominant trait pattern from a traits object.
 * Accepts an optional traitLabels map from the theme.
 */
function describePattern(traits, traitLabels) {
  const sorted = Object.entries(traits || {}).sort((a, b) => b[1] - a[1]);
  const [topTrait, topScore] = sorted[0] || ["", 0];
  if (!topScore) return "Unreadable";
  const labels = traitLabels || {
    guarded: "Guarded",
    confessional: "Confessional",
    controlling: "Control-seeking",
    curious: "Curious",
    performative: "Performative",
    vulnerable: "Exposed",
  };
  return labels[topTrait] || "Unreadable";
}

module.exports = { buildSystemPrompt, buildMessages, describePattern };
