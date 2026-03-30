const { isKvConfigured, kvGetJson, kvSetJson, kvIncr } = require("./_lib/kv");

function buildInviteCode(number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = Math.max(1, Number(number || 1));
  let out = "";

  while (out.length < 6) {
    out = alphabet[value % alphabet.length] + out;
    value = Math.floor(value / alphabet.length);
  }

  return out.slice(-6);
}

async function resolveContact(contactToken) {
  if (!contactToken) {
    return null;
  }

  return kvGetJson(`signal:contact:${contactToken}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isKvConfigured()) {
    res.status(503).json({ ok: false, error: "kv_not_configured" });
    return;
  }

  const { action, contactToken, sessionLabel = "", groupCode = "" } = req.body || {};
  if (!action || !contactToken) {
    res.status(400).json({ ok: false, error: "missing_group_payload" });
    return;
  }

  const contact = await resolveContact(contactToken);
  if (!contact?.contactId) {
    res.status(404).json({ ok: false, error: "contact_not_found" });
    return;
  }

  if (action === "create") {
    const nextNumber = await kvIncr("signal:next_group_number");
    const invite = buildInviteCode(nextNumber);
    const group = {
      id: `GROUP-${nextNumber}`,
      inviteCode: invite,
      createdBy: contact.contactId,
      createdByToken: contactToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [
        {
          contactId: contact.contactId,
          contactToken,
          sessionLabel,
          joinedAt: new Date().toISOString(),
          role: "host",
        },
      ],
      status: "open",
    };

    await kvSetJson(`signal:group:${invite}`, group);
    res.status(200).json({
      ok: true,
      groupId: group.id,
      inviteCode: group.inviteCode,
      memberCount: group.members.length,
      status: group.status,
    });
    return;
  }

  if (action === "join") {
    if (!groupCode) {
      res.status(400).json({ ok: false, error: "missing_group_code" });
      return;
    }

    const normalizedCode = String(groupCode).trim().toUpperCase();
    const existing = await kvGetJson(`signal:group:${normalizedCode}`);
    if (!existing) {
      res.status(404).json({ ok: false, error: "group_not_found" });
      return;
    }

    const memberIndex = existing.members.findIndex((member) => member.contactToken === contactToken);
    if (memberIndex >= 0) {
      existing.members[memberIndex] = {
        ...existing.members[memberIndex],
        sessionLabel: sessionLabel || existing.members[memberIndex].sessionLabel || "",
        joinedAt: existing.members[memberIndex].joinedAt || new Date().toISOString(),
      };
    } else {
      existing.members.push({
        contactId: contact.contactId,
        contactToken,
        sessionLabel,
        joinedAt: new Date().toISOString(),
        role: "member",
      });
    }

    existing.updatedAt = new Date().toISOString();
    await kvSetJson(`signal:group:${normalizedCode}`, existing);
    res.status(200).json({
      ok: true,
      groupId: existing.id,
      inviteCode: existing.inviteCode,
      memberCount: existing.members.length,
      status: existing.status,
      members: existing.members.map((member) => ({
        contactId: member.contactId,
        sessionLabel: member.sessionLabel || "",
        role: member.role,
      })),
    });
    return;
  }

  res.status(400).json({ ok: false, error: "unknown_group_action" });
};
