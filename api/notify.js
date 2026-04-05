/**
 * api/notify.js — Echo Activity Email Notifications
 *
 * Sends a brief, mysterious email to the player when their Echo has been active.
 * The email teases what happened without giving everything away — the goal is to
 * create urgency to log back in and deal with the consequences.
 *
 * Rate limited to 1 notification per player per 24 hours to prevent spam.
 * Uses Resend (resend.com) — set RESEND_API_KEY env var to enable.
 *
 * Called internally by the idle cron (api/idle.js) after Echo Quest generation.
 * Secured by x-notify-secret header matching CRON_SECRET.
 */

const { isKvConfigured, kvGetJson, kvSetJson } = require("./_lib/kv");

const NOTIFY_RATE_KEY = (contactId) => `signal:notify:rate:${contactId}`;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// The game URL to link back to
const GAME_URL = process.env.APP_URL || "https://unknown-signal.vercel.app";

// Sender identity
const FROM_ADDRESS = process.env.NOTIFY_FROM || "echo@unknown-signal.io";
const FROM_NAME = "Unknown Signal";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  // Secure this endpoint — only the idle cron should call it
  const secret = req.headers["x-notify-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Email not configured — silently succeed so the cron doesn't fail
    res.status(200).json({ ok: true, skipped: "email_not_configured" });
    return;
  }

  const { email, contactId, severity, echoAction, hook, allyNeeded, questId } = req.body || {};

  if (!email || !contactId) {
    res.status(400).json({ ok: false, error: "missing_email_or_contact_id" });
    return;
  }

  // Rate limit — max 1 notification per 24 hours per player
  if (isKvConfigured()) {
    const rateKey = NOTIFY_RATE_KEY(contactId);
    const lastNotified = await kvGetJson(rateKey).catch(() => null);
    if (lastNotified && Date.now() - new Date(lastNotified).getTime() < TWENTY_FOUR_HOURS_MS) {
      res.status(200).json({ ok: true, skipped: "rate_limited" });
      return;
    }
  }

  const subject = buildSubject(severity, echoAction);
  const html = buildEmailHtml(severity, echoAction, hook, allyNeeded);
  const text = buildEmailText(severity, echoAction, hook, allyNeeded);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to: [email],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Resend error:", response.status, errorBody);
      res.status(502).json({ ok: false, error: "email_send_failed" });
      return;
    }

    // Record successful notification for rate limiting
    if (isKvConfigured()) {
      await kvSetJson(NOTIFY_RATE_KEY(contactId), new Date().toISOString()).catch(() => {});
    }

    res.status(200).json({ ok: true, questId });
  } catch (err) {
    console.error("Notify error:", err.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
};

function buildSubject(severity, echoAction) {
  const teasers = {
    catastrophic: "Your Echo has gone off the deep end.",
    critical: "Your Echo is in serious trouble.",
    heavy: "Your Echo made a mess. A real one.",
    medium: "Your Echo did something while you were gone.",
    light: "Your Echo left you something to deal with.",
  };
  return teasers[severity] || "Your Echo was active.";
}

function buildEmailHtml(severity, echoAction, hook, allyNeeded) {
  const urgencyColor = {
    catastrophic: "#ff2222",
    critical: "#ff6600",
    heavy: "#ffaa00",
    medium: "#aaaaaa",
    light: "#666666",
  }[severity] || "#888888";

  const urgencyLabel = {
    catastrophic: "CRISIS",
    critical: "URGENT",
    heavy: "SERIOUS",
    medium: "ACTIVE",
    light: "NOTE",
  }[severity] || "ACTIVE";

  // Truncate echoAction for the email — tease it, don't dump it
  const actionTease = echoAction
    ? echoAction.split(".")[0] + "."
    : "Something happened while you were away.";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0a0a0a; color: #c8c8c8; font-family: 'Courier New', monospace; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .header { border-bottom: 1px solid #222; padding-bottom: 20px; margin-bottom: 28px; }
    .signal { color: #33ff88; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; }
    .severity { color: ${urgencyColor}; font-size: 11px; letter-spacing: 0.15em; margin-top: 6px; }
    .headline { font-size: 18px; color: #e8e8e8; margin: 20px 0 12px; line-height: 1.4; }
    .action { color: #999; font-size: 14px; line-height: 1.6; margin-bottom: 20px; font-style: italic; }
    .hook { background: #111; border-left: 3px solid ${urgencyColor}; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #ccc; }
    .ally-note { color: #aaa; font-size: 13px; margin-top: 16px; }
    .cta { display: inline-block; margin-top: 28px; padding: 12px 24px; background: #33ff88; color: #000; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #1a1a1a; font-size: 11px; color: #444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="signal">// UNKNOWN SIGNAL</div>
      <div class="severity">[${urgencyLabel}] ECHO ACTIVITY LOGGED</div>
    </div>

    <div class="headline">You were offline. Your Echo wasn't.</div>

    <div class="action">${escapeHtml(actionTease)}</div>

    <div class="hook">
      <strong>Right now:</strong> ${escapeHtml(hook || "Something is waiting for you when you return.")}
    </div>

    ${allyNeeded ? `<div class="ally-note">⚠ This may be too big to handle alone. You might need to find someone.</div>` : ""}

    <a href="${GAME_URL}" class="cta">Return to the Signal</a>

    <div class="footer">
      You're receiving this because your character is active in Unknown Signal.<br>
      Your Echo acts whether you're there or not.
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(severity, echoAction, hook, allyNeeded) {
  const urgencyLabel = {
    catastrophic: "CRISIS",
    critical: "URGENT",
    heavy: "SERIOUS",
    medium: "ACTIVE",
    light: "NOTE",
  }[severity] || "ACTIVE";

  const actionTease = echoAction
    ? echoAction.split(".")[0] + "."
    : "Something happened while you were away.";

  return [
    "// UNKNOWN SIGNAL — ECHO ACTIVITY LOGGED",
    `[${urgencyLabel}]`,
    "",
    "You were offline. Your Echo wasn't.",
    "",
    actionTease,
    "",
    "Right now: " + (hook || "Something is waiting for you when you return."),
    allyNeeded ? "\nThis may be too big to handle alone." : "",
    "",
    "Return to the Signal: " + GAME_URL,
    "",
    "---",
    "Your Echo acts whether you're there or not.",
  ].filter((l) => l !== undefined).join("\n");
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
