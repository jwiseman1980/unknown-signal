# Themes

The Unknown Signal engine and its themes are separate. The engine handles narrative persistence, character memory, player profiling, combat mechanics, and Claude integration. Themes handle everything players actually experience: the world, the entity speaking to them, the locations, the characters, the enemies, and the moral texture of the scenarios.

To build a new game on this engine, create a folder here and implement the theme interface below.

---

## Directory structure

```
themes/
  unknown-signal/       ← cyber-horror, The Echo, Undertow district
    theme.js
  your-new-theme/
    theme.js
    style.css           ← optional, if the theme ships its own visual skin
```

---

## Theme interface

A theme is a plain JS object exported from `theme.js`. Every field below is required unless marked optional.

```js
module.exports = {

  // ── Identity ──────────────────────────────────────────────────

  id: "your-theme-id",          // snake_case, unique
  name: "Your Theme Name",      // display name

  // ── AI Persona ────────────────────────────────────────────────

  // The AI entity's identity — 1-4 paragraphs. This is the opening
  // of the system prompt. Who is speaking? What does it want?
  // What is it not? How does it exist in this world?
  persona: `You are ...`,

  // Voice and style rules — how the entity speaks, what it avoids,
  // core phrases, example lines. Markdown ## header included.
  voiceSection: `## YOUR VOICE\n- ...`,

  // ── Game Phases ───────────────────────────────────────────────

  // Returns phase-specific instructions based on current game state.
  // The engine injects this as ## GAME PHASE. Return empty string if
  // no special phase logic is needed.
  //
  // @param {object} gameState - full game state from client
  // @returns {string}
  getPhaseInstructions(gameState) { ... },

  // ── World Detail ──────────────────────────────────────────────

  // Returns the full world detail section: locations, NPCs, factions,
  // interactable objects, movement rules. This is the largest block
  // of theme content. Inject markdown headers freely.
  // gameState is passed in case you want to conditionally show content
  // (e.g. only show a location once it's been discovered).
  //
  // @param {object} gameState
  // @returns {string}
  getWorldDetailSection(gameState) { ... },

  // Returns a one-line description of a specific scene/location for the
  // ## WORLD STATE block. Should reflect dynamic sceneState flags.
  //
  // @param {string} scene - scene key (must be in validScenes)
  // @param {object} sceneState - current scene flags
  // @returns {string}
  getSceneDescription(scene, sceneState) { ... },

  // ── Combat ────────────────────────────────────────────────────

  // One sentence injected into the death rule in the combat section.
  // Describes what happens narratively when the player dies.
  // Example: "Describe the ancient forest reclaiming their body."
  deathFlavor: "...",

  // Returns the combat world section: enemies by location, loot tables,
  // death/respawn description. Injected after the engine's combat rules.
  //
  // @returns {string}
  getCombatWorldSection() { ... },

  // ── Response Schema Extensions ────────────────────────────────

  // Object merged into the JSON schema example shown to the AI.
  // Add any theme-specific response fields with null as placeholder.
  // Example: { simulation: null, factionEvent: null }
  responseSchemaExample: {},

  // Field rule strings for any theme-specific response fields.
  // Injected into the ## RESPONSE FORMAT section after core field rules.
  // Return empty string if no extensions.
  // Example: `- **simulation**: To start a sim, set to {...}. null otherwise.`
  responseSchemaFields: "",

  // ── Valid State Mutations ─────────────────────────────────────

  // The AI is only allowed to set currentScene to one of these values.
  // Must match the keys used in getSceneDescription().
  validScenes: ["scene-one", "scene-two"],

  // The AI is only allowed to set sceneState keys from this list.
  // Prevents hallucinated state mutations.
  validSceneStateKeys: ["flagOne", "flagTwo"],

  // ── Trait Labels ──────────────────────────────────────────────

  // Optional. Override the display names for player trait axes.
  // Default labels are used if this is omitted.
  // The six trait axes are fixed by the engine; only the labels change.
  traitLabels: {             // optional
    guarded: "Guarded",
    confessional: "Confessional",
    controlling: "Control-seeking",
    curious: "Curious",
    performative: "Performative",
    vulnerable: "Exposed",
  },
};
```

---

## What the engine provides (you don't need to add these)

The following sections are injected automatically by the engine for every theme:

- `## CHARACTER HISTORY` — cross-session character memory loaded from KV
- `## NARRATIVE STATE` — current story arc, plot threads, key decisions
- `## WORLD STATE` — current scene + scene flags + active cases
- `## PLAYER PROFILE` — contact ID, session count, traits, attention level
- `## COMBAT SYSTEM` — player combat stats + universal combat rules
- `## RESPONSE FORMAT` — core JSON schema (replies, stateChanges, combat, newCase, narrativeUpdates)

The engine also owns: message history formatting, character KV persistence, narrative update application, session summaries.

---

## Engine-level response fields (always present)

These are returned by the AI and processed by the engine regardless of theme:

| Field | Type | Description |
|---|---|---|
| `replies` | string[] | The lines the AI entity speaks this turn |
| `stateChanges.currentScene` | string\|null | Scene transition |
| `stateChanges.sceneState` | object | Scene flag updates |
| `stateChanges.traits` | object | Trait increments |
| `combat` | object\|null | Combat resolution |
| `newCase` | object\|null | New case birth |
| `sceneTransition` | string\|null | `"enterWorld"` on first world entry |
| `narrativeUpdates` | object\|null | Story arc / thread / decision updates |

Theme-specific fields (like `simulation` in Unknown Signal) are defined in `responseSchemaFields` and handled by the client.

---

## Building a new theme — quick checklist

- [ ] Create `themes/your-id/theme.js`
- [ ] Set `id` and `name`
- [ ] Write `persona` (who is the AI entity in this world?)
- [ ] Write `voiceSection` (how does it speak?)
- [ ] Implement `getPhaseInstructions(gameState)`
- [ ] Implement `getWorldDetailSection(gameState)`
- [ ] Implement `getSceneDescription(scene, sceneState)`
- [ ] Set `deathFlavor`
- [ ] Implement `getCombatWorldSection()`
- [ ] Set `validScenes` and `validSceneStateKeys`
- [ ] Update `api/world.js` to `require("../themes/your-id/theme")`
- [ ] Add theme-specific client logic for any `responseSchemaExample` extensions
