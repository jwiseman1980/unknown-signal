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
 * @param {object} gameState - Full game state from the client
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

    // 4. Narrative state — engine-managed, theme-neutral
    buildNarrativeSection(memory),

    // 5. Current world state — engine structure, theme provides scene description
    buildWorldStateSection(currentScene, sceneState, cases, theme),

    // 6. Player profile — engine-managed, theme-neutral
    buildPlayerProfileSection(traits, attention, contactId, sessions, interactionCount, selfLabel, pattern),

    // 7. World detail — entirely theme content (locations, NPCs, factions)
    theme.getWorldDetailSection(gameState),

    // 8. Combat — engine rules + player state, theme provides enemy tables
    buildCombatSection(c, theme),

    // 9. Response schema — engine core fields + theme extensions
    buildResponseSchemaSection(theme, contactId),
  ];

  return sections.join("\n\n");
}

function buildGamePhaseSection(gameState, theme) {
  return `## GAME PHASE\n${theme.getPhaseInstructions(gameState)}`;
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
    "This is a GemStone III-style text MUD. Combat is real-time, dangerous, and resolved through narrative.",
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
    "- Resolve attacks using player skills + weapon + enemy difficulty. Higher skill = better outcomes.",
    "- After each player action, apply ROUNDTIME (1-5 seconds). During roundtime, the enemy acts.",
    "- Enemies deal damage to player HP. Player deals damage to enemy HP.",
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
    "- **narrativeUpdates**: Story evolution object, or null. Schema:",
    "  { \"storyArc\": \"updated one-sentence arc for this player, or null to keep current\", \"addThreads\": [{\"id\":\"snake_case_id\",\"summary\":\"one-sentence unresolved tension\"}], \"resolveThreads\": [\"id_to_remove\"], \"addDecision\": {\"summary\":\"what the player chose and what it reveals about them\"}, \"dominantTone\": \"one-word tone shift or null\" }",
    "  Guidelines: Update storyArc when the player's situation meaningfully shifts. Add a thread whenever a new tension surfaces. Resolve threads when they conclude or collapse. Add a decision for any meaningful player choice. Keep total active threads under 8.",
  ].filter(Boolean).join("\n");
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
