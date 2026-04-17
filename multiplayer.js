// Unknown Signal — Linked Play module
// Loaded after app.js. Uses addMessage and queueEchoReplies from the global scope.
(function () {
  "use strict";

  const MP = {
    active: false,
    groupCode: null,
    ablyClient: null,
    ablyChannel: null,
  };

  // ── UI refs (resolved after DOM is ready) ──────────────────
  let createGroupBtn, joinGroupBtn, groupCodeInput, groupStatus, groupCodeDisplay;

  function init() {
    createGroupBtn = document.querySelector("#mpCreateGroup");
    joinGroupBtn = document.querySelector("#mpJoinGroup");
    groupCodeInput = document.querySelector("#mpGroupCodeInput");
    groupStatus = document.querySelector("#mpGroupStatus");
    groupCodeDisplay = document.querySelector("#mpGroupCodeDisplay");

    if (createGroupBtn) {
      createGroupBtn.addEventListener("click", createGroup);
    }
    if (joinGroupBtn) {
      joinGroupBtn.addEventListener("click", () => {
        const code = (groupCodeInput?.value || "").trim().toUpperCase();
        if (code) joinGroup(code);
        else setStatus("Enter a thread code first.");
      });
    }
  }

  // ── Create group ────────────────────────────────────────────
  async function createGroup() {
    const contactToken = getContactToken();
    if (!contactToken) {
      setStatus("Start the signal first — play through the intro.");
      return;
    }
    setStatus("Creating linked thread...");
    disableButtons(true);
    try {
      const res = await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          contactToken,
          sessionLabel: getLabel(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "create_failed");
      MP.groupCode = data.inviteCode;
      if (groupCodeDisplay) {
        groupCodeDisplay.textContent = data.inviteCode;
        groupCodeDisplay.classList.remove("hidden");
      }
      setStatus("Thread open. Share this code with your partner.");
      await connectAbly(data.inviteCode, contactToken);
    } catch (err) {
      setStatus("Error: " + err.message);
      disableButtons(false);
    }
  }

  // ── Join group ──────────────────────────────────────────────
  async function joinGroup(code) {
    const contactToken = getContactToken();
    if (!contactToken) {
      setStatus("Start the signal first — play through the intro.");
      return;
    }
    setStatus("Joining thread " + code + "...");
    disableButtons(true);
    try {
      const res = await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          contactToken,
          groupCode: code,
          sessionLabel: getLabel(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "join_failed");
      MP.groupCode = data.inviteCode;
      setStatus(
        data.memberCount + " contact(s) in thread " + data.inviteCode + "."
      );
      await connectAbly(data.inviteCode, contactToken);
    } catch (err) {
      setStatus("Error: " + err.message);
      disableButtons(false);
    }
  }

  // ── Ably connection ─────────────────────────────────────────
  async function connectAbly(groupCode, contactToken) {
    if (typeof Ably === "undefined") {
      setStatus("Ably SDK not loaded — multiplayer unavailable.");
      disableButtons(false);
      return;
    }

    const authUrl =
      "/api/ably-token?clientId=" + encodeURIComponent(contactToken);

    // Health-check before handing off to Ably
    try {
      const probe = await fetch(authUrl);
      if (!probe.ok) {
        const e = await probe.json().catch(function () {
          return {};
        });
        setStatus(
          e.error === "multiplayer_not_configured"
            ? "Multiplayer not configured. Add ABLY_API_KEY to Vercel env vars."
            : "Token error: " + (e.error || probe.status)
        );
        disableButtons(false);
        return;
      }
    } catch (err) {
      setStatus("Realtime check failed: " + err.message);
      disableButtons(false);
      return;
    }

    try {
      MP.ablyClient = new Ably.Realtime({
        authUrl: authUrl,
        clientId: contactToken,
      });

      MP.ablyClient.connection.on("failed", function () {
        setStatus("Realtime connection failed.");
        MP.active = false;
      });

      const channelName = "scene:" + groupCode;
      MP.ablyChannel = MP.ablyClient.channels.get(channelName);

      MP.ablyChannel.subscribe(function (msg) {
        const payload = msg.data || {};
        // Skip messages we sent ourselves
        if (payload.fromToken === contactToken) return;
        handleIncoming(payload);
      });

      MP.active = true;
      setStatus("Linked. Thread: " + groupCode);
      addMessage(
        "echo",
        "Linked thread active. Another contact has entered the signal."
      );
    } catch (err) {
      setStatus("Connection error: " + err.message);
      disableButtons(false);
    }
  }

  // ── Incoming message handler ────────────────────────────────
  function handleIncoming(payload) {
    const event = payload.event;
    const data = payload.data || {};
    const label = data.sessionLabel || "Partner";

    if (event === "player_action") {
      addMessage("echo", "[ " + label + " ] " + data.text);
    } else if (event === "narrative") {
      const replies = Array.isArray(data.replies) ? data.replies : [];
      if (replies.length && typeof queueEchoReplies === "function") {
        queueEchoReplies(
          ["— signal via " + label + " —"].concat(replies),
          false
        );
      }
    }
  }

  // ── Outgoing publish ────────────────────────────────────────
  function publishAction(text) {
    if (!MP.active || !MP.ablyChannel) return;
    MP.ablyChannel
      .publish("signal", {
        fromToken: getContactToken(),
        event: "player_action",
        data: { text: text, sessionLabel: getLabel() },
      })
      .catch(function () {});
  }

  function publishNarrative(action, replies) {
    if (!MP.active || !MP.ablyChannel) return;
    MP.ablyChannel
      .publish("signal", {
        fromToken: getContactToken(),
        event: "narrative",
        data: { action: action, replies: replies, sessionLabel: getLabel() },
      })
      .catch(function () {});
  }

  // ── Helpers ─────────────────────────────────────────────────
  function getContactToken() {
    try {
      const threadKey =
        localStorage.getItem("unknown-signal-active-thread-v1") || "default";
      const storageKey = "unknown-signal-contact-token-v1:" + threadKey;
      const stored = localStorage.getItem(storageKey);
      return stored || "contact:" + threadKey.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function getLabel() {
    try {
      const threadKey =
        localStorage.getItem("unknown-signal-active-thread-v1") || "default";
      const memKey = "unknown-signal-memory-v1:" + threadKey;
      const raw = localStorage.getItem(memKey);
      if (raw) {
        const mem = JSON.parse(raw);
        return mem.selfLabel || mem.contactId || "Contact";
      }
    } catch (e) {}
    return "Contact";
  }

  function setStatus(msg) {
    if (groupStatus) groupStatus.textContent = msg;
  }

  function disableButtons(disabled) {
    if (createGroupBtn) createGroupBtn.disabled = disabled;
    if (joinGroupBtn) joinGroupBtn.disabled = disabled;
  }

  // ── Expose globals for app.js hooks ─────────────────────────
  window.multiplayerPublishAction = publishAction;
  window.multiplayerPublishNarrative = publishNarrative;

  // Self-init — DOM is ready since we're loaded at bottom of body
  init();
})();
