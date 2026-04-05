/**
 * api/idle.js — Echo Agency (Idle Character Simulation)
 *
 * While you are offline, your Echo doesn't sleep. It acts.
 *
 * Your behavioral fingerprint — the personality profile The Echo has built from
 * everything you've done — becomes an autonomous agent in the world. But the Echo
 * is imperfect. It over-indexes on your dominant traits. It makes choices you might
 * not have made. It gets into trouble.
 *
 * When you return, you inherit what your Echo did. Their decisions are your debts,
 * your enemies, your obligations. Some of the mess is too big to clean up alone.
 *
 * Severity escalates with absence duration:
 *   < 12h  → light    (a small misstep, solvable alone)
 *   12-24h → medium   (a real problem, takes work)
 *   24-72h → heavy    (serious damage, hard to fix alone)
 *   > 72h  → critical (catastrophic — needs another player)
 *
 * Set up in vercel.json crons. Requires CRON_SECRET env var.
 */

const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const IDLE_INDEX_KEY = "signal:idle:index";
const MAX_PER_RUN = 10;
const MIN_IDLE_HOURS = 12;

function getIdleSeverity(hoursIdle) {
  if (hoursIdle > 168) return "catastrophic"; // 7+ days — the Echo has gone full rogue
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

  // Find idle characters (absent long enough, no unread events queued)
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

      const hoursIdle = Math.floor(
        (now - new Date(entry.lastPlayedAt).getTime()) / (1000 * 60 * 60)
      );
      const severity = getIdleSeverity(hoursIdle);
      const isNpc = entry.isNpc || false;

      if (isNpc) {
        // NPCs get the simple idle event — world acted on them
        if ((profile.idleEvents || []).some((e) => !e.read)) continue;

        const event = await simulateEchoAgency(profile, hoursIdle, severity, true, apiKey);
        if (!event) continue;

        profile.idleEvents = [
          { ...event, at: new Date().toISOString(), read: false, severity, hoursIdle },
          ...(profile.idleEvents || []),
        ].slice(0, 10);
      } else {
        // Player characters get Echo Quests — structured problems from their shadow self
        const existingQuests = profile.echoQuests || [];
        // Don't stack — skip if there's already an unseen quest
        if (existingQuests.some((q) => !q.seen && !q.resolved)) continue;

        const event = await simulateEchoAgency(profile, hoursIdle, severity, false, apiKey);
        if (!event) continue;

        const questId = `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const quest = {
          id: questId,
          ...event,
          severity,
          hoursIdle,
          at: new Date().toISOString(),
          seen: false,
          resolved: false,
        };

        profile.echoQuests = [quest, ...existingQuests].slice(0, 8);

        // Fire notification — player should know their Echo is causing trouble
        if (profile.notifyEmail) {
          triggerNotification(profile, quest, entry.token).catch((err) =>
            console.error("Notify error:", entry.contactId, err.message)
          );
        }
      }

      profile.updatedAt = new Date().toISOString();
      await kvSetJson(charKey, profile);
      results.push({
        contactId: entry.contactId || entry.token,
        type: event.type,
        severity,
        allyNeeded: event.allyNeeded || false,
        isNpc,
      });
    } catch (err) {
      console.error("Idle agency error:", entry.contactId, err.message);
    }
  }

  // Write back pruned index
  if (active.length !== index.length) {
    await kvSetJson(IDLE_INDEX_KEY, active.slice(0, 500));
  }

  res.status(200).json({ ok: true, processed: results.length, results });
};

/**
 * Simulate what the player's Echo did while they were offline.
 * The Echo acts based on the player's behavioral profile — but imperfectly.
 * It over-indexes on dominant traits, misreads situations, causes trouble.
 * The returned event is framed as the Echo's actions becoming the player's quests.
 */
async function simulateEchoAgency(profile, hoursIdle, severity, isNpc, apiKey) {
  const decisions = (profile.cumulativeDecisions || [])
    .slice(0, 5)
    .map((d) => d.summary || d);
  const latestSession = profile.sessionSummaries?.[0];
  const arc = latestSession?.arc || "";
  const tone = latestSession?.tone || "";
  const sessionCount = profile.sessionSummaries?.length || 0;

  const daysIdle = Math.floor(hoursIdle / 24);
  const timePhrase = daysIdle > 0
    ? `${daysIdle} day${daysIdle !== 1 ? "s" : ""}`
    : `${hoursIdle} hours`;

  const needsAllyHint = severity === "critical" || severity === "catastrophic" || severity === "heavy";
  const hasHistory = decisions.length > 0;

  // Infer moral alignment from decision history — this shapes how the Echo behaves
  const decisionText = decisions.join(" ").toLowerCase();
  const goodSignals = ["helped", "protected", "saved", "stood up", "shared", "refused to betray", "gave", "warned", "defended"];
  const badSignals = ["betrayed", "stole", "attacked", "lied", "manipulated", "took", "killed", "threatened", "abandoned"];
  const goodScore = goodSignals.filter((w) => decisionText.includes(w)).length;
  const badScore = badSignals.filter((w) => decisionText.includes(w)).length;
  const alignment = !hasHistory ? "unknown" : goodScore > badScore + 1 ? "good" : badScore > goodScore + 1 ? "bad" : "mixed";

  const alignmentContext = {
    good: `This player tends to DO THE RIGHT THING — help people, protect the weak, stand up when others don't.
Their Echo continued doing good things while they were gone. The WORLD is the problem.
The Echo helped someone. Intervened in something. Stood up to someone powerful. Did the decent thing.
And now there are consequences — because this is a brutal city and being good is expensive.
The trouble isn't from the Echo's bad decisions. It's the price of the Echo's good ones.
Examples of this energy: helped a Black Clinic refugee, now the Choir of Glass considers you an enemy; refused to give up someone's location, now you owe a favor you can't pay; stood up for a stranger and made a powerful contact's enemy list.`,
    bad: `This player tends toward selfish, reckless, or destructive choices.
Their Echo ran completely unchecked — no filter, no conscience, all impulse. Body-in-the-bathtub energy.
The trouble comes directly from the Echo's terrible decisions: fights it started, deals it burned, things it took.
Examples: the Echo picked a fight with Hush for no reason and now they're hunting the player; the Echo went on a spending bender and cleaned out the player's credits with Black Clinic debt; the Echo blackmailed the wrong person and now there's a kill order.`,
    mixed: `This player is somewhere in between — sometimes decent, sometimes not.
Their Echo's problems could come from either direction: a good intention that backfired, an impulse that went too far, or just the city being what it is.
Mix it up — maybe the Echo tried to help and the help made things worse, or the Echo's worst instinct finally caught up with them.`,
    unknown: `No behavioral history. The Echo is operating on almost nothing.
It went with the most obvious default behavior available and made it complicated.
Keep the action simple but the consequence specific.`,
  };

  // Tone anchors per severity for alignment=bad (keep existing dark energy for bad players)
  const darkToneExamples = {
    light: "You jack in to find your contact has blocked you — your Echo said something unhinged at 3am. Solvable, just embarrassing.",
    medium: "You wake up to a debt notice from Black Clinic. Your Echo apparently needed something badly enough to sign for it.",
    heavy: "There's a body in your usual safehouse. Your Echo started something with Hush. They know where you sleep.",
    critical: "Your Echo went on a full bender — made deals with three factions, burned two of them, and now both sides want you.",
    catastrophic: "You've been gone so long your Echo basically became you. It had a whole arc. Made enemies. Made friends. Then destroyed them.",
  };

  const goodToneExamples = {
    light: "Your Echo helped someone out of a Black Clinic debt. Now that person is following you around like a shadow and their creditor noticed.",
    medium: "Your Echo pulled someone out of a Hush sweep. Now Hush is asking questions about who tipped off their target.",
    heavy: "Your Echo refused to give up a survivor's location under pressure. Now the people doing the pressuring are looking for you specifically.",
    critical: "Your Echo went full protector — intervened in something major, stood up for people who couldn't stand up for themselves, made powerful enemies doing it. The city doesn't reward that.",
    catastrophic: "Your Echo has been playing hero for a week. Seven days of doing the right thing. The factions have taken notice. Being right doesn't mean being safe.",
  };

  const toneRef = alignment === "good"
    ? goodToneExamples[severity]
    : darkToneExamples[severity];

  const prompt = `You are writing Echo Agency events for a cyberpunk RPG. Tone: dark, personal, gritty, sometimes darkly funny. Noir fiction where consequences are personal and the city is cruel.

CORE CONCEPT: When a player is offline, their behavioral shadow — the Echo — keeps acting. The Echo IS them, amplified and unmoderated. The player returns to deal with what their shadow did.

CRITICAL RULE — THE ECHO REFLECTS THE PLAYER'S ACTUAL ALIGNMENT:
${alignmentContext[alignment]}

Tone reference for this player at ${severity} severity:
"${toneRef}"

The consequences must feel PERSONAL. Not "a faction threatens the district." More like:
- "you owe Black Clinic 400 credits and their collector is at your corner"
- "there's a stranger sleeping in your safehouse who says you owe them"
- "Hush is asking questions about you specifically, not generally"

Player absent for: ${timePhrase}
Severity: ${severity}
Alignment read: ${alignment}

${isNpc ? "NPC character — world inhabitant with their own agenda." : "Player character. Generate based on their alignment above."}

Character history:
- Sessions: ${sessionCount} | Arc: ${arc || "not established"} | Tone: ${tone || "unknown"}
${hasHistory ? `- What this person has revealed:\n${decisions.map((d) => "  " + d).join("\n")}` : "- No history — Echo is operating erratically."}

Generate ONE Echo Agency event grounded in who this person actually is.

Rules:
- Be specific: name the NPC, name the faction, name the physical thing that is now present or missing
- The consequence is in their personal space: safehouse, contacts, credits, reputation
- Resolution requires active engagement — they have to face what happened
- ${needsAllyHint ? "allyNeeded: true — too big to fix alone. Another player's help is required." : "allyNeeded: false — solvable solo, even if it hurts."}
- Locations: Clinic Block C, Relay Shelter, Service Junction, Flooded Platform, Quarantine Gate
- Factions: Hush, Choir of Glass, Black Clinic, Null Meridian, The Borrowed

Return valid JSON only:
{
  "type": "fight" | "deal" | "theft" | "betrayal" | "recklessness" | "allegiance",
  "echoAction": "What the Echo did. 2 sentences, past tense. Personal and specific.",
  "echoRationale": "The impulse behind it. 1 sentence. What trait drove this and how it went wrong (or why goodness was punished).",
  "consequence": "What's waiting now. 2-3 sentences. Concrete. Who is angry, what is owed, what is present.",
  "hook": "The first unavoidable thing when they return. 1 sentence.",
  "resolution": "What it takes to fix this. 1-2 sentences. Named faction, NPC, or location.",
  "allyNeeded": ${needsAllyHint ? "true" : "false"},
  "allyReason": ${needsAllyHint ? '"Why another player is required. 1 sentence."' : "null"}
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
      max_tokens: 500,
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
