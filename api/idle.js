/**
 * api/idle.js — Idle Character Simulation (Vercel Cron)
 *
 * The world moves with or without the player. Characters who don't engage
 * face escalating consequences. This cron runs daily and simulates what
 * happens to idle characters — players and NPC echoes alike.
 *
 * Severity escalates with absence duration:
 *   < 12h  → light    (discovery, small encounter)
 *   12-24h → medium   (complication, faction notice)
 *   24-72h → heavy    (consequence, threat arrives)
 *   > 72h  → critical (significant threat, the world did not wait)
 *
 * Set up in vercel.json crons. Requires CRON_SECRET env var.
 */

const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const IDLE_INDEX_KEY = "signal:idle:index";
const MAX_PER_RUN = 10;
const MIN_IDLE_HOURS = 12;

function getIdleSeverity(hoursIdle) {
  if (hoursIdle > 72) return "critical";
  if (hoursIdle > 24) return "heavy";
  if (hoursIdle > 12) return "medium";
  return "light";
}

module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "ai_not_configured" });
    return;
  }

  const index = (await kvGetJson(IDLE_INDEX_KEY)) || [];
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const MIN_IDLE_MS = MIN_IDLE_HOURS * 60 * 60 * 1000;

  // Prune entries inactive for 30+ days
  const active = index.filter(
    (e) => e.lastPlayedAt && now - new Date(e.lastPlayedAt).getTime() < THIRTY_DAYS_MS
  );

  // Find idle characters (not played recently, no unread events yet)
  const eligible = active.filter(
    (e) => now - new Date(e.lastPlayedAt).getTime() >= MIN_IDLE_MS
  );

  const toProcess = eligible.slice(0, MAX_PER_RUN);
  const results = [];

  for (const entry of toProcess) {
    try {
      const charKey = `signal:character:${entry.token}`;
      const profile = await kvGetJson(charKey);
      if (!profile) continue;

      // Don't pile up events — skip if already has unread
      if ((profile.idleEvents || []).some((e) => !e.read)) continue;

      const hoursIdle = Math.floor(
        (now - new Date(entry.lastPlayedAt).getTime()) / (1000 * 60 * 60)
      );
      const severity = getIdleSeverity(hoursIdle);

      const event = await simulateIdle(profile, hoursIdle, severity, entry.isNpc, apiKey);
      if (!event) continue;

      profile.idleEvents = [
        { ...event, at: new Date().toISOString(), read: false, severity, hoursIdle },
        ...(profile.idleEvents || []),
      ].slice(0, 10);
      profile.updatedAt = new Date().toISOString();

      await kvSetJson(charKey, profile);
      results.push({
        contactId: entry.contactId || entry.token,
        type: event.type,
        severity,
        isNpc: entry.isNpc || false,
      });
    } catch (err) {
      console.error("Idle sim error:", entry.contactId, err.message);
    }
  }

  // Write back pruned index
  if (active.length !== index.length) {
    await kvSetJson(IDLE_INDEX_KEY, active.slice(0, 500));
  }

  res.status(200).json({ ok: true, processed: results.length, results });
};

async function simulateIdle(profile, hoursIdle, severity, isNpc, apiKey) {
  const decisions = (profile.cumulativeDecisions || [])
    .slice(0, 4)
    .map((d) => d.summary || d);
  const latestSession = profile.sessionSummaries?.[0];
  const arc = latestSession?.arc || "";
  const tone = latestSession?.tone || "";
  const sessionCount = profile.sessionSummaries?.length || 0;

  const daysIdle = Math.floor(hoursIdle / 24);
  const timePhrase = daysIdle > 0
    ? `${daysIdle} day${daysIdle !== 1 ? "s" : ""}`
    : `${hoursIdle} hours`;

  const severityGuides = {
    light: "Something small but specific — a message waiting, an object noticed, a brief contact. Intriguing, not threatening.",
    medium: "Something that creates a complication or surfaces a tension — a faction noticed them, a contact went quiet, something they left unfinished moved.",
    heavy: "Real consequence — an injury, a resource lost, a relationship strained, a faction development that affects them directly.",
    critical: "Significant and threatening. The world did not pause. Something has changed that requires response. Stakes are real.",
  };

  const prompt = `You are generating an idle world event for a character in a persistent narrative RPG. The setting: a collapsed cyberpunk city monitored by an emergent AI called The Echo. Factions fight for control. The world has real stakes and does not wait.

Character has been absent for: ${timePhrase}
Event severity: ${severity} — ${severityGuides[severity]}
Character type: ${isNpc ? "a world inhabitant with their own agenda" : "an absent player character"}
Sessions played: ${sessionCount}
Established behavioral pattern:
${decisions.length ? decisions.map((d) => `  - ${d}`).join("\n") : "  (no history — new character)"}
Last story arc: ${arc || "none"}
Tone: ${tone || "unknown"}

Generate ONE idle event that:
- Is grounded in their specific history — references what they've actually done
- Fits the severity level precisely
- Feels like the WORLD acted, not a random event generator
- Ends with a concrete hook or consequence waiting on return
- Does NOT invent new world locations or major lore

Return valid JSON only — no other text:
{
  "type": "discovery" | "encounter" | "consequence" | "threat",
  "summary": "2-3 sentences describing exactly what happened",
  "hook": "one sentence — what is waiting or unresolved when they return",
  "consequence": "brief mechanical note or null — e.g. 'faction standing reduced', 'injured: -20 max HP until treated at clinic', 'item lost', 'contact gone silent'"
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
      max_tokens: 350,
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
 * Add or update a character in the idle index.
 * Called from character.js whenever a profile is saved.
 */
async function updateIdleIndex(token, contactId, isNpc) {
  const index = (await kvGetJson(IDLE_INDEX_KEY)) || [];
  const existingIdx = index.findIndex((e) => e.token === token);
  const entry = { token, contactId, isNpc: isNpc || false, lastPlayedAt: new Date().toISOString() };

  if (existingIdx >= 0) {
    index[existingIdx] = entry;
  } else {
    index.unshift(entry);
  }

  await kvSetJson(IDLE_INDEX_KEY, index.slice(0, 500));
}

module.exports.updateIdleIndex = updateIdleIndex;
