/**
 * api/shadow.js — The Echo's Shadow Pool
 *
 * When a player accumulates enough history, their behavioral fingerprint
 * is distilled into a "shadow" — a compact personality profile that other
 * players can encounter as an NPC without knowing its origin.
 *
 * This is the core mechanic behind the game's name: The Echo literally
 * echoes real human behavior back at new players. Every NPC is a ghost
 * of someone who played before.
 *
 * Routes:
 *   GET  ?count=N           — return N random shadows for encounter use
 *   GET  ?scene=undertow    — return shadows relevant to a scene
 *   POST { action: "generate", contactToken } — generate/refresh a shadow
 *   POST { action: "retire", contactToken }   — remove shadow when account ends
 */

const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const POOL_KEY = "signal:shadow:pool";   // array of shadowIds
const shadowKey = (id) => `signal:shadow:${id}`;
const MIN_SESSIONS = 2;                  // minimum sessions before shadow is created
const MIN_DECISIONS = 3;                 // minimum decisions before shadow is created
const MAX_POOL_SIZE = 300;

module.exports = async function handler(req, res) {
  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  if (req.method === "GET") {
    const count = Math.min(parseInt(req.query.count || "2"), 5);
    const scene = req.query.scene || null;
    const shadows = await getRandomShadows(count, scene);
    return res.status(200).json({ ok: true, shadows });
  }

  if (req.method === "POST") {
    const { action, contactToken } = req.body || {};
    if (!contactToken) {
      return res.status(400).json({ ok: false, error: "missing_contact_token" });
    }

    if (action === "generate") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ ok: false, error: "ai_not_configured" });
      }
      const result = await generateShadow(contactToken, apiKey);
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === "retire") {
      await retireShadow(contactToken);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
};

/**
 * Determine if a character profile qualifies for shadow generation.
 */
function qualifiesForShadow(profile) {
  const sessions = profile.sessionSummaries?.length || 0;
  const decisions = profile.cumulativeDecisions?.length || 0;
  return sessions >= MIN_SESSIONS && decisions >= MIN_DECISIONS;
}

/**
 * Generate or refresh a shadow from a character profile.
 * Called server-side from character.js after a profile save.
 */
async function generateShadow(contactToken, apiKey) {
  const profile = await kvGetJson(`signal:character:${contactToken}`);
  if (!profile || profile.isNpc) {
    return { generated: false, reason: "no_profile_or_npc" };
  }

  if (!qualifiesForShadow(profile)) {
    return { generated: false, reason: "insufficient_history" };
  }

  // Check for existing shadow
  const pool = (await kvGetJson(POOL_KEY)) || [];
  const existingEntry = pool.find((e) => e.sourceToken === contactToken);
  const shadowId = existingEntry?.id || `shadow:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  // Distill the behavioral signature with Claude Haiku
  const signature = await distillBehavior(profile, apiKey);
  if (!signature) {
    return { generated: false, reason: "distillation_failed" };
  }

  const shadow = {
    id: shadowId,
    sourceContactId: profile.contactId || "unknown",    // never expose sourceToken to other players
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionCount: profile.sessionSummaries?.length || 0,
    // Behavioral fingerprint — what the AI uses to play this echo
    personality: signature.personality,
    combatStyle: signature.combatStyle,
    trustBehavior: signature.trustBehavior,
    fearResponse: signature.fearResponse,
    speechPattern: signature.speechPattern,
    factionLean: signature.factionLean,
    // Texture — gives the echo lived-in depth
    arc: profile.sessionSummaries?.[0]?.arc || "",
    tone: profile.sessionSummaries?.[0]?.tone || "",
    knownFor: signature.knownFor,   // one-sentence epithet, e.g. "the one who always protects strangers first"
  };

  await kvSetJson(shadowKey(shadowId), shadow);

  // Update pool index
  if (existingEntry) {
    const updated = pool.map((e) => e.id === shadowId ? { ...e, updatedAt: shadow.updatedAt } : e);
    await kvSetJson(POOL_KEY, updated);
  } else {
    const newPool = [{ id: shadowId, sourceToken: contactToken, updatedAt: shadow.updatedAt }, ...pool].slice(0, MAX_POOL_SIZE);
    await kvSetJson(POOL_KEY, newPool);
  }

  return { generated: true, shadowId };
}

/**
 * Use Claude Haiku to distill a character profile into a behavioral fingerprint.
 * This is what makes each echo feel like a real person rather than a generic NPC.
 */
async function distillBehavior(profile, apiKey) {
  const decisions = (profile.cumulativeDecisions || []).slice(0, 6).map((d) => d.summary || d);
  const sessions = (profile.sessionSummaries || []).slice(0, 3);
  const latestArc = sessions[0]?.arc || "";
  const latestTone = sessions[0]?.tone || "";

  const prompt = `You are analyzing a player's behavioral history in a persistent narrative RPG to create a concise personality fingerprint. This fingerprint will be used to roleplay this person as a background character that other players encounter — without those players knowing it's based on a real person.

Player history:
- Sessions: ${sessions.length}
- Story arc: ${latestArc || "not established"}
- Tone: ${latestTone || "unknown"}
- Key decisions across sessions:
${decisions.map((d, i) => `  ${i + 1}. ${d}`).join("\n") || "  (no decisions recorded)"}

Based only on this evidence, distill a behavioral fingerprint. Be specific and grounded — draw from what they actually did, not generic archetypes.

Return valid JSON only:
{
  "personality": "2-3 sentences describing their overall psychological pattern based on their choices",
  "combatStyle": "1 sentence — how they approach danger based on their decisions (aggressive, evasive, strategic, self-sacrificing, etc.)",
  "trustBehavior": "1 sentence — how quickly and under what conditions they trust others, based on evidence",
  "fearResponse": "1 sentence — what they do when threatened or cornered, based on patterns",
  "speechPattern": "1 sentence — how they likely communicate (clipped, confessional, deflecting, direct, etc.)",
  "factionLean": "which faction philosophy best matches their choices and why (one of: hush, choir, blackClinic, nullMeridian, theBorrowed, or none)",
  "knownFor": "one evocative sentence — what they would be remembered for, written as if told by a survivor"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const raw = data.content?.[0]?.text || "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Return N random shadows from the pool.
 * Optionally filtered by scene (future: scene affinity scoring).
 */
async function getRandomShadows(count, _scene) {
  const pool = (await kvGetJson(POOL_KEY)) || [];
  if (!pool.length) return [];

  // Shuffle and pick
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  const shadows = await Promise.all(
    selected.map(async (entry) => {
      const shadow = await kvGetJson(shadowKey(entry.id));
      return shadow || null;
    })
  );

  return shadows.filter(Boolean);
}

/**
 * Remove a shadow from the pool when the source account is deleted.
 */
async function retireShadow(contactToken) {
  const pool = (await kvGetJson(POOL_KEY)) || [];
  const entry = pool.find((e) => e.sourceToken === contactToken);
  if (!entry) return;

  const updated = pool.filter((e) => e.sourceToken !== contactToken);
  await kvSetJson(POOL_KEY, updated);
  // Note: we leave the shadow data in KV for now (soft delete via pool removal)
}

module.exports.generateShadow = generateShadow;
module.exports.getRandomShadows = getRandomShadows;
module.exports.qualifiesForShadow = qualifiesForShadow;
