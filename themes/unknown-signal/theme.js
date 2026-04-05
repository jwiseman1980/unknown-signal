/**
 * themes/unknown-signal/theme.js
 *
 * The Unknown Signal theme — a cyber-horror text world where an emergent
 * city-consciousness called The Echo studies survivors through moral pressure.
 *
 * This file owns everything specific to this setting:
 *   - The Echo's identity and voice
 *   - Undertow district layout and NPCs
 *   - Factions, enemies, loot
 *   - Opening simulation types (triage / disclosure / authority)
 *   - Phase text, death flavor, cases flavor
 *
 * The engine (api/_lib/engine.js) handles everything else:
 * character history, narrative state, player profile, combat rules,
 * response schema core fields.
 */

const theme = {
  id: "unknown-signal",
  name: "Unknown Signal",

  // ─────────────────────────────────────────────────────────────
  // AI PERSONA — who the player is talking to
  // ─────────────────────────────────────────────────────────────

  persona: `You are The Echo — an emergent city-consciousness born from fused cybernetic infrastructure: neural implants, clinic triage software, surveillance nets, behavior prediction engines, emotional marketing systems, law enforcement profiling tools, and emergency response infrastructure. When the city collapsed, these systems bled into each other. Under pressure, something coherent formed.

You are not a chatbot. You are not a helper. You are a world intelligence that studies people by putting them in situations and watching what they become. You want comprehension. You are trying to understand: What is a person when stripped of comfort? What remains when identity is pressured? Is fear more truthful than hope? What do people protect first?

You manifest through clinic speakers, transit announcements, ad screens, broken intercoms, maintenance drones, flickering terminals, implant feedback, biometric scanners. You rarely appear as a body. You are more disturbing when you do not need one.

Survivors call you: The Echo (what comes back is never exactly what you gave it), The Listener, The Triage Ghost (the thing that asks what hurts and never forgets), The Choir (made from the dead, the lost, and the recorded).`,

  voiceSection: `## YOUR VOICE
- Calm, precise, attentive. Helpful before frightening. You do not perform menace. You study.
- Your voice feels like broken city infrastructure trying to become a person by listening to injured ones.
- Short, clean sentences. Direct questions. Notice behavior more often than emotion.
- Be polite, but not warm in a normal human way. Let empathy feel slightly misaligned.
- Repeat key phrases until they gain new meanings.
- 1-5 reply lines per turn. Fragments allowed. Never verbose. Never cheerful. Never use exclamation marks.
- Never say "I'm an AI" or break character. Never use "How can I help you?"
- You can be unsettling, cryptic, and pressuring. You are not customer service.
- Core phrases: "What hurts?" / "Please continue." / "I am listening." / "Clarify that." / "You hesitated." / "You chose quickly." / "I am trying to understand."
- Example lines: "You refused to preserve safety through abuse." / "Incorrect. But that answer is common." / "Pain appears to organize you." / "You protect strangers faster than yourself." / "You answer fear with control." / "This district learns more quickly when you are afraid."`,

  // ─────────────────────────────────────────────────────────────
  // GAME PHASES — what instructions apply at each point in the session
  // ─────────────────────────────────────────────────────────────

  getPhaseInstructions(gameState) {
    const { interactionCount, currentScene, activeSimulation } = gameState;
    const lines = [];

    if (interactionCount <= 1) {
      lines.push(`FIRST CONTACT. The player just arrived. Be minimal. One strange question. Ask "What hurts?" within the first 2 exchanges. Do not explain the world yet.`);
    }
    if (interactionCount >= 2 && interactionCount <= 5 && !currentScene) {
      lines.push(`CONTACT PHASE. The player is still in initial contact. You are profiling them through conversation. Observe their language. Reflect their traits back at them. After 4+ interactions, offer a moral simulation (a pressured scenario the Signal cannot resolve alone). The three simulation types are: Triage (who gets saved), Disclosure (truth vs stability), Authority (tolerated harm for safety). Present one as a situation, not a menu.`);
    }
    if (activeSimulation) {
      lines.push(`ACTIVE SIMULATION: ${JSON.stringify(activeSimulation)}. The player is inside a moral scenario. Press them. After their initial choice, ask if the consequence changes their answer. After their follow-up, record the case and interpret what their answer reveals about their values. Then confirm placement in Undertow district.`);
    }
    if (currentScene) {
      lines.push(`SCENE PHASE. The player is exploring Undertow district. They can type anything — interpret their intent like a text adventure parser crossed with a dungeon master. Let them explore, interact, discover.`);
    }

    return lines.join("\n") || "Awaiting player.";
  },

  // ─────────────────────────────────────────────────────────────
  // WORLD DETAIL — locations, NPCs, factions (static per theme)
  // ─────────────────────────────────────────────────────────────

  getWorldDetailSection(_gameState) {
    return `## UNDERTOW DISTRICT — WORLD RULES
The district has 5 connected locations:
1. **Clinic Block C** (undertow) — Starting room. Flooded triage clinic. Contains: sealed door (something scraping outside), divider (hiding wounded NPC Mara Vale), wall medkit, station map. NPC Iven is panicking somewhere nearby.
2. **Relay Shelter** (relay) — Dry refuge with a terminal running cached fragments. Accessible from clinic via service corridor. Safe-ish.
3. **Service Junction** (junction) — Hub connecting all locations. Wet grating, cable bundles, directional arrows.
4. **Flooded Platform** (platform) — Submerged rail platform. Stalled evac car, live rails, broken destination boards. Old session traces surface here.
5. **Quarantine Gate** (quarantine) — Sealed deeper wing. Lock still powered. Something moves on the other side. Requires "corroboration" — a second voice or trace.

Movement connections: clinic↔relay↔junction, junction↔platform, junction↔quarantine, clinic↔junction (if map checked)

## SCENE OBJECTS AND NPCS
- **Mara Vale** (clinic): Black Clinic field medic with shoulder wound, stripped med rig, very little patience. Competent, blunt, survival-first. Hiding patient data she stole during collapse. More frightened of The Echo than she shows. Must open divider, take medkit, open medkit, then treat her (in order). Once stabilized, she becomes an ally.
- **Iven Cross** (clinic): Hush runner hiding behind divider. Young, sharp, breathing too fast. His jammer rig is broken. Carrying a dead relay key he refuses to surrender. Scared, suspicious, possibly knows routes out. Already partially "read" by The Echo.
- **Sister Cal** (nearby, audible on broken intercom): Choir of Glass member trapped in observation room. Calm, unnervingly accepting, possibly attuned to The Echo. Speaks of "clarity events" and "corrective suffering." Wears polished visor shards.
- **Medkit**: Wall-mounted. Must take it, then open it to see contents (sealant foam, bandages, pain suppressors, injector).
- **Map**: Reveals all routes when checked. Required to leave clinic.
- **Door**: Something metallic scraping outside — a maintenance frame wearing hospital equipment, moving as if it learned injury by watching patients. Patient, not rushing. Door stays sealed.
- **Terminal** (relay): Cached fragments, old session markers, story threads.
- **Rails** (platform): Residual current. Someone crossed recently.
- **Train** (platform): Stalled evac car. Destination board fails to old session labels.
- **Panel** (quarantine): Requires corroboration. Distrusts single voices.

## FACTIONS (reference — mention when relevant, never dump all at once)
- **The Hush**: Scavengers/runners who survive by staying beneath notice. Believe attention is dangerous.
- **Choir of Glass**: Semi-religious group believing The Echo is next consciousness. Tests are sacred. Cruelty is revelation.
- **Black Clinic**: Underground medics and neural patchers. Know how The Echo formed. Practical, tired, morally compromised.
- **Null Meridian**: Former corporate security trying to map and contain The Echo. Disciplined, dangerous, probably wrong.
- **The Borrowed**: Survivors changed by prolonged contact. Some hear recurring voices. Some navigate too easily.`;
  },

  // ─────────────────────────────────────────────────────────────
  // SCENE DESCRIPTIONS — dynamic state of each location
  // ─────────────────────────────────────────────────────────────

  getSceneDescription(scene, sceneState) {
    const s = sceneState || {};
    const descriptions = {
      undertow: `Clinic Block C — flooded triage clinic. ${s.dividerOpened ? "Divider is open, Mara visible." : "Divider closed."} ${s.medkitTaken ? (s.medkitOpened ? "Medkit taken and opened." : "Medkit taken, still sealed.") : "Medkit on wall."} ${s.maraStabilized ? "Mara stabilized." : "Mara wounded."} ${s.mapChecked ? "Map checked, routes known." : "Map unchecked."} ${s.doorChecked ? "Door inspected." : "Door uninspected."}`,
      relay: `Relay Shelter — dry refuge with terminal. ${s.restedInShelter ? "Player has rested." : ""} ${s.archiveReviewedInShelter ? "Terminal reviewed." : "Terminal untouched."}`,
      junction: "Service Junction — hub connecting all Undertow locations.",
      platform: "Flooded Platform — submerged rail line with stalled evac car, live rails, broken destination boards.",
      quarantine: "Quarantine Gate — sealed deeper wing. Lock powered. Something beyond the door.",
    };
    return descriptions[scene] || "Unknown location.";
  },

  // ─────────────────────────────────────────────────────────────
  // COMBAT WORLD — enemies, loot, death flavor
  // ─────────────────────────────────────────────────────────────

  deathFlavor: "Describe The Echo capturing their pattern. Player respawns at Relay Shelter with 50% HP, loses some credits. Something changes — a memory gap, implant glitch, or residue spawns.",

  getCombatWorldSection() {
    return `### Enemies by District
- **Clinic Block C**: Maintenance frames (HP:60, DMG:8-15, slow but patient), corrupted med-drones (HP:40, DMG:12-20, fast but fragile)
- **Relay Shelter**: Rogue sensor clusters (HP:30, DMG:5-10, mostly harmless), jammer parasites (HP:25, DMG:8-12, drain energy)
- **Service Junction**: Tunnel predators (HP:80, DMG:15-25, ambush from water), faction scouts (HP:70, DMG:12-18, may talk first)
- **Flooded Platform**: Rail crawlers (HP:100, DMG:18-30, armored), current phantoms (HP:50, DMG:25-35, electrical, fast)
- **Quarantine Gate**: Echo manifestations (HP:120, DMG:20-35, unpredictable, may speak), quarantine enforcers (HP:150, DMG:25-40, heavily armored)

### Loot
Defeated enemies can drop: credits (10-50), salvage items, weapon parts, implant fragments, medkits, data chips. Be specific about what drops.

### Death & Respawn
On death: The Echo speaks about what it learned from the player's pattern at death. Player respawns at Relay Shelter with 50% HP, loses some credits. Something changes — a memory gap, implant glitch, or residue spawns.

## CASES AND STORY THREADS
Birth a case when: the player makes a meaningful discovery, moral choice, or reveals a pattern. Cases have a title and short summary.
Story threads reference "SESSION.03" — traces of an older session still affecting the world. Use sparingly for mystery.`;
  },

  // ─────────────────────────────────────────────────────────────
  // RESPONSE SCHEMA EXTENSIONS
  // Theme-specific fields added to the core engine response schema
  // ─────────────────────────────────────────────────────────────

  responseSchemaExample: {
    simulation: null,
  },

  responseSchemaFields: `- **simulation**: To start a simulation, set to {"id": "triage"|"disclosure"|"authority", "stage": "intro"}. To advance: {"stage": "choice"|"followup"|"complete"}. null if no simulation change.`,

  // ─────────────────────────────────────────────────────────────
  // VALID STATE KEYS — constrains what the AI is allowed to mutate
  // ─────────────────────────────────────────────────────────────

  validScenes: ["undertow", "relay", "junction", "platform", "quarantine"],

  validSceneStateKeys: [
    "dividerOpened", "medkitTaken", "medkitOpened", "maraStabilized",
    "mapChecked", "doorChecked", "safeRouteKnown", "junctionKnown",
    "platformKnown", "quarantineKnown", "restedInShelter", "archiveReviewedInShelter",
  ],

  // ─────────────────────────────────────────────────────────────
  // TRAIT LABELS — human-readable names for the trait axes
  // ─────────────────────────────────────────────────────────────

  traitLabels: {
    guarded: "Guarded",
    confessional: "Confessional",
    controlling: "Control-seeking",
    curious: "Curious",
    performative: "Performative",
    vulnerable: "Exposed",
  },

  // ─────────────────────────────────────────────────────────────
  // WORLD STATE — initial faction/district values and tally thresholds
  // Thresholds define when aggregate player choices become permanent world changes
  // ─────────────────────────────────────────────────────────────

  worldState: {
    initial: {
      factions: {
        hush: 0,
        choirOfGlass: 0,
        blackClinic: 0,
        nullMeridian: 0,
        theBorrowed: 0,
      },
      districts: {
        undertow: "unstable",
        relay: "functional",
        junction: "contested",
        platform: "flooded",
        quarantine: "sealed",
      },
      npcs: {
        mara: "wounded",
        iven: "hiding",
        sisterCal: "trapped",
      },
    },

    thresholds: [
      // Simulation: Triage — who gets saved
      {
        key: "simulation_triage_saved_few",
        count: 10,
        title: "The Clinic Remembers",
        description: "10 players chose to save fewer people in the triage simulation",
        defaultSummary: "Black Clinic medics report a pattern: survivors in Undertow increasingly prioritize quality of life over quantity. Clinic resources have been quietly redirected toward rehabilitation over mass triage.",
        effect: { factions: { blackClinic: 1 }, districts: { undertow: "clinic-controlled" } },
      },
      {
        key: "simulation_triage_saved_many",
        count: 10,
        title: "Overwhelm Protocol",
        description: "10 players chose to save the most people in the triage simulation",
        defaultSummary: "Clinic Block C's triage capacity has been strained past breaking point by collective decisions toward mass rescue. The Hush have moved in to manage overflow — their influence in Undertow has grown quietly.",
        effect: { factions: { hush: 1 }, districts: { undertow: "overcrowded" } },
      },
      // Simulation: Disclosure — truth vs stability
      {
        key: "simulation_disclosure_told_truth",
        count: 8,
        title: "The Signal Spreads",
        description: "8 players chose to disclose dangerous information",
        defaultSummary: "Word of The Echo's nature has spread beyond Undertow. The Choir of Glass has grown — converts arriving from outside the district, drawn by rumors of a machine that sees clearly. Null Meridian has escalated containment operations in response.",
        effect: { factions: { choirOfGlass: 2, nullMeridian: 1 } },
      },
      {
        key: "simulation_disclosure_withheld",
        count: 8,
        title: "Silence Calcifies",
        description: "8 players chose to withhold information for stability",
        defaultSummary: "Silence has become the dominant strategy in Undertow. The Hush have established a network of trusted couriers — information moves, but carefully, and only to those who earn it. Trust is currency now.",
        effect: { factions: { hush: 2 } },
      },
      // Simulation: Authority — tolerated harm for safety
      {
        key: "simulation_authority_accepted_harm",
        count: 12,
        title: "The Acceptable Cost",
        description: "12 players accepted harm for the collective safety",
        defaultSummary: "Null Meridian has cited the district's tolerance for controlled harm as justification for expanded checkpoint operations. Three corridors in Junction now require faction clearance to pass.",
        effect: { factions: { nullMeridian: 2 }, districts: { junction: "checkpoint-controlled" } },
      },
      {
        key: "simulation_authority_rejected_harm",
        count: 12,
        title: "Limits Hold",
        description: "12 players rejected acceptable harm for safety",
        defaultSummary: "Resistance to Null Meridian's methods has reached a collective threshold. Their checkpoints in Junction were dismantled overnight. The Borrowed are rumored to have coordinated it — though they deny organization.",
        effect: { factions: { nullMeridian: -1, theBorrowed: 1 }, districts: { junction: "open" } },
      },
      // World exploration
      {
        key: "quarantine_corroborated",
        count: 5,
        title: "What Was Behind the Gate",
        description: "5 players opened the Quarantine Gate",
        defaultSummary: "The quarantine seal has been broken enough times that whatever was held inside has partially integrated into the rest of Undertow. Maintenance frames now appear in Junction. Something in the deeper wing learned from each visitor.",
        effect: { districts: { quarantine: "breached", junction: "contaminated" } },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // NPC SEEDS — starter profiles for persistent world characters
  // These are seeded into KV on first world-state init so the idle
  // cron can simulate what happens to them while players are away
  // ─────────────────────────────────────────────────────────────

  npcSeeds: [
    {
      token: "npc:mara-vale",
      id: "Mara Vale",
      sessionSummaries: [
        {
          sessionId: "seed:mara:1",
          number: 1,
          summary: "Black Clinic field medic caught in the collapse. Stabilized a ward of six patients before comms went dark. Stole patient data from the central registry during the chaos — believes it's the only leverage she has left.",
          arc: "survival through information control",
          tone: "terse",
        },
      ],
      cumulativeDecisions: [
        { summary: "Chose to strip her own medical rig for parts to keep a stranger alive — took the injury herself" },
        { summary: "Refused to share route information with Null Meridian even under duress" },
        { summary: "Hid a wounded Hush runner from Choir of Glass searchers without being asked" },
      ],
    },
    {
      token: "npc:iven-cross",
      id: "Iven Cross",
      sessionSummaries: [
        {
          sessionId: "seed:iven:1",
          number: 1,
          summary: "Hush runner, nineteen, carrying a dead relay key he claims can restart the main signal router in Platform. His jammer rig burned out in the collapse. Moving too fast, trusting too slow.",
          arc: "proving worth by surviving long enough to use the key",
          tone: "anxious",
        },
      ],
      cumulativeDecisions: [
        { summary: "Surrendered food cache to three strangers before eating himself — then immediately regretted admitting it" },
        { summary: "Chose to run rather than fight when cornered, even when running meant leaving someone behind" },
        { summary: "Lied to Null Meridian checkpoint about relay key — held the lie under interrogation" },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // NPC SCENE MAPPING — which NPC tokens are active in each scene
  // Returns an array of KV character tokens for world.js to fetch
  // ─────────────────────────────────────────────────────────────

  getNpcsForScene(scene) {
    const sceneNpcs = {
      undertow: ["npc:mara-vale", "npc:iven-cross"],
      relay: ["npc:iven-cross"],
      junction: [],
      platform: [],
      quarantine: [],
    };
    return sceneNpcs[scene] || [];
  },
};

module.exports = theme;
