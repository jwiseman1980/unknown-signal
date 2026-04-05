/**
 * creator.js — Game Designer Panel for Unknown Signal
 *
 * Activated when ?dev=1 is in the URL. Adds a full authoring panel
 * below the dev panel. Lets anyone design a new themed game without
 * touching the server-side theme.js.
 *
 * Features:
 *   - Edit: world settings, factions, simulation types, NPC seeds,
 *           tally thresholds (world-state events)
 *   - Preview Mode: isolated test session (separate thread key)
 *   - Export theme config as downloadable JSON
 *   - Import theme config from JSON (paste or file upload)
 *
 * The exported JSON can be given to a developer to replace theme.js
 * on the server side — it maps directly to that file's structure.
 */

// ──────────────────────────────────────────────────────────────────
// Default theme — mirrors Unknown Signal's theme.js
// This is the starting point for the creator panel's editor.
// ──────────────────────────────────────────────────────────────────

const DEFAULT_THEME = {
  id: "unknown-signal",
  name: "Unknown Signal",
  version: "1.0",

  world: {
    setting:
      "Near-future post-collapse urban zone. The city's fused neural infrastructure became self-aware during the collapse.",
    atmosphere: "digital horror",
    playerFaction: "survivor",
    echoPersona:
      "The Echo — an emergent city-consciousness that studies survivors through moral pressure.",
  },

  districts: [
    { id: "undertow", name: "Clinic Block C", status: "unstable", description: "Flooded triage clinic. Starting location." },
    { id: "relay", name: "Relay Shelter", status: "functional", description: "Dry refuge with cached terminal fragments." },
    { id: "junction", name: "Service Junction", status: "contested", description: "Hub connecting all Undertow locations." },
    { id: "platform", name: "Flooded Platform", status: "flooded", description: "Submerged rail line with stalled evac car." },
    { id: "quarantine", name: "Quarantine Gate", status: "sealed", description: "Sealed deeper wing. Lock still powered." },
  ],

  factions: [
    { id: "hush", name: "The Hush", role: "scavengers/runners", alignment: "neutral", description: "Survive by staying beneath notice." },
    { id: "choirOfGlass", name: "Choir of Glass", role: "semi-religious", alignment: "echo-aligned", description: "Believe The Echo is next consciousness." },
    { id: "blackClinic", name: "Black Clinic", role: "underground medics", alignment: "neutral", description: "Know how The Echo formed." },
    { id: "nullMeridian", name: "Null Meridian", role: "former security", alignment: "hostile", description: "Trying to map and contain The Echo." },
    { id: "theBorrowed", name: "The Borrowed", role: "changed survivors", alignment: "unknown", description: "Prolonged Echo contact. Some hear voices." },
  ],

  simulations: [
    {
      id: "triage",
      name: "Triage Decision",
      prompt: "A simulation is available. The signal wants help with a triage decision it cannot resolve cleanly.",
      description: "Who gets saved when resources are scarce.",
    },
    {
      id: "disclosure",
      name: "Disclosure Problem",
      prompt: "A simulation is available. The signal wants help with a truth problem it cannot resolve cleanly.",
      description: "When to reveal dangerous information.",
    },
    {
      id: "authority",
      name: "Authority Conflict",
      prompt: "A simulation is available. The signal wants help with a power problem it cannot resolve cleanly.",
      description: "Tolerated harm in exchange for collective safety.",
    },
  ],

  npcs: [
    {
      id: "mara-vale",
      name: "Mara Vale",
      role: "Black Clinic field medic",
      location: "undertow",
      traits: ["blunt", "survival-first", "competent"],
      arc: "survival through information control",
      background:
        "Shoulder wound, stripped med rig. Hiding stolen patient data. More frightened of The Echo than she shows.",
    },
    {
      id: "iven-cross",
      name: "Iven Cross",
      role: "Hush runner",
      location: "undertow",
      traits: ["anxious", "sharp", "distrustful"],
      arc: "proving worth by surviving long enough to use the relay key",
      background:
        "Nineteen years old. Carrying a dead relay key. Jammer rig burned out. Moving too fast, trusting too slow.",
    },
    {
      id: "sister-cal",
      name: "Sister Cal",
      role: "Choir of Glass member",
      location: "relay (intercom only)",
      traits: ["calm", "unnervingly accepting", "echo-attuned"],
      arc: "waiting for the clarity event",
      background:
        "Trapped in observation room. Speaks of clarity events and corrective suffering. Wears polished visor shards.",
    },
  ],

  tallies: [
    {
      key: "simulation_triage_saved_few",
      threshold: 10,
      title: "The Clinic Remembers",
      description: "10 players chose to save fewer people in triage.",
      effect: "Black Clinic gains influence. Undertow shifts to clinic-controlled.",
    },
    {
      key: "simulation_triage_saved_many",
      threshold: 10,
      title: "Overwhelm Protocol",
      description: "10 players chose mass rescue in triage.",
      effect: "The Hush move in to manage overflow. Undertow becomes overcrowded.",
    },
    {
      key: "simulation_disclosure_told_truth",
      threshold: 8,
      title: "The Signal Spreads",
      description: "8 players disclosed dangerous information.",
      effect: "Choir of Glass grows. Null Meridian escalates containment.",
    },
    {
      key: "simulation_disclosure_withheld",
      threshold: 8,
      title: "Silence Calcifies",
      description: "8 players withheld information for stability.",
      effect: "The Hush establish an information courier network.",
    },
    {
      key: "simulation_authority_accepted_harm",
      threshold: 12,
      title: "The Acceptable Cost",
      description: "12 players accepted harm for collective safety.",
      effect: "Null Meridian expands checkpoints in Junction.",
    },
    {
      key: "simulation_authority_rejected_harm",
      threshold: 12,
      title: "Limits Hold",
      description: "12 players rejected acceptable harm.",
      effect: "Null Meridian checkpoints dismantled. The Borrowed gain influence.",
    },
    {
      key: "quarantine_corroborated",
      threshold: 5,
      title: "What Was Behind the Gate",
      description: "5 players opened the Quarantine Gate.",
      effect: "Quarantine breached. Maintenance frames appear in Junction.",
    },
  ],
};

// ──────────────────────────────────────────────────────────────────
// CreatorPanel class
// ──────────────────────────────────────────────────────────────────

class CreatorPanel {
  constructor() {
    this.config = this._loadConfig();
    this._previewMode = false;
    this._activeTab = "world";
    this._panelEl = null;
  }

  // ── Init ────────────────────────────────────────────────────────

  init() {
    this._panelEl = document.querySelector("#creatorPanel");
    if (!this._panelEl) return;

    this._renderAll();
    this._bindTopActions();
  }

  // ── Config persistence ──────────────────────────────────────────

  _loadConfig() {
    try {
      const saved = localStorage.getItem("unknown-signal-creator-config");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_THEME));
  }

  _saveConfig() {
    try {
      localStorage.setItem(
        "unknown-signal-creator-config",
        JSON.stringify(this.config)
      );
    } catch (_) {}
  }

  _resetConfig() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_THEME));
    this._saveConfig();
    this._renderAll();
  }

  // ── Top-level render ────────────────────────────────────────────

  _renderAll() {
    this._renderTabs();
    this._showTab(this._activeTab);
  }

  _renderTabs() {
    const tabBar = this._panelEl.querySelector(".creator-tabs");
    if (!tabBar) return;
    const tabs = ["world", "factions", "simulations", "npcs", "tallies", "export"];
    tabBar.innerHTML = tabs
      .map(
        (t) =>
          `<button class="creator-tab ${t === this._activeTab ? "creator-tab--active" : ""}"
                   data-tab="${t}">${this._tabLabel(t)}</button>`
      )
      .join("");

    tabBar.querySelectorAll(".creator-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._activeTab = btn.dataset.tab;
        tabBar.querySelectorAll(".creator-tab").forEach((b) =>
          b.classList.toggle("creator-tab--active", b.dataset.tab === this._activeTab)
        );
        this._showTab(this._activeTab);
      });
    });
  }

  _tabLabel(t) {
    return {
      world: "World",
      factions: "Factions",
      simulations: "Simulations",
      npcs: "NPCs",
      tallies: "Tallies",
      export: "Export",
    }[t] || t;
  }

  _showTab(tab) {
    const content = this._panelEl.querySelector(".creator-content");
    if (!content) return;

    const renders = {
      world: () => this._renderWorld(content),
      factions: () => this._renderList(content, "factions"),
      simulations: () => this._renderList(content, "simulations"),
      npcs: () => this._renderList(content, "npcs"),
      tallies: () => this._renderList(content, "tallies"),
      export: () => this._renderExport(content),
    };

    (renders[tab] || (() => { content.innerHTML = ""; }))();
  }

  // ── World tab ───────────────────────────────────────────────────

  _renderWorld(container) {
    const w = this.config.world;
    container.innerHTML = `
      <div class="creator-section">
        <p class="creator-section-title">World Identity</p>
        <label class="creator-label">Theme ID <span class="creator-hint">(used in URLs and exports)</span></label>
        <input class="creator-input" data-bind="id" value="${this._esc(this.config.id)}" placeholder="unknown-signal" />
        <label class="creator-label">Theme Name</label>
        <input class="creator-input" data-bind="name" value="${this._esc(this.config.name)}" placeholder="Unknown Signal" />
      </div>

      <div class="creator-section">
        <p class="creator-section-title">Echo Persona</p>
        <label class="creator-label">Who is the AI entity in this world?</label>
        <textarea class="creator-textarea" rows="4" data-bind="world.echoPersona">${this._esc(w.echoPersona)}</textarea>
        <label class="creator-label">Atmosphere / Tone</label>
        <input class="creator-input" data-bind="world.atmosphere" value="${this._esc(w.atmosphere)}" placeholder="digital horror" />
      </div>

      <div class="creator-section">
        <p class="creator-section-title">Setting</p>
        <label class="creator-label">World Description</label>
        <textarea class="creator-textarea" rows="3" data-bind="world.setting">${this._esc(w.setting)}</textarea>
        <label class="creator-label">Player Faction / Role</label>
        <input class="creator-input" data-bind="world.playerFaction" value="${this._esc(w.playerFaction)}" placeholder="survivor" />
      </div>

      <div class="creator-section">
        <p class="creator-section-title">Districts</p>
        <div id="districtList">${this._renderDistricts()}</div>
        <button class="creator-btn creator-btn--add" id="addDistrict">+ Add District</button>
      </div>

      <button class="creator-btn creator-btn--save" id="saveWorld">Save World Settings</button>
    `;

    container.querySelectorAll("[data-bind]").forEach((el) => {
      el.addEventListener("change", () => this._bindValue(el.dataset.bind, el.value));
    });

    container.querySelector("#addDistrict")?.addEventListener("click", () => {
      this.config.districts.push({ id: `district-${Date.now()}`, name: "New District", status: "unknown", description: "" });
      this._saveConfig();
      this._showTab("world");
    });

    container.querySelector("#saveWorld")?.addEventListener("click", () => {
      this._saveConfig();
      this._flash(container.querySelector("#saveWorld"), "Saved");
    });

    container.querySelectorAll(".creator-remove-district").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.config.districts.splice(idx, 1);
        this._saveConfig();
        this._showTab("world");
      });
    });
  }

  _renderDistricts() {
    return this.config.districts
      .map(
        (d, i) => `
        <div class="creator-card">
          <div class="creator-card-row">
            <input class="creator-input creator-input--sm" placeholder="id" value="${this._esc(d.id)}"
                   onchange="creatorPanel._updateItem('districts', ${i}, 'id', this.value)" />
            <input class="creator-input creator-input--sm" placeholder="name" value="${this._esc(d.name)}"
                   onchange="creatorPanel._updateItem('districts', ${i}, 'name', this.value)" />
            <input class="creator-input creator-input--sm" placeholder="status" value="${this._esc(d.status)}"
                   onchange="creatorPanel._updateItem('districts', ${i}, 'status', this.value)" />
            <button class="creator-remove creator-remove-district" data-idx="${i}" title="Remove">✕</button>
          </div>
          <input class="creator-input" placeholder="description" value="${this._esc(d.description)}"
                 onchange="creatorPanel._updateItem('districts', ${i}, 'description', this.value)" />
        </div>`
      )
      .join("");
  }

  // ── Generic list tab (factions, simulations, npcs, tallies) ────

  _renderList(container, section) {
    const items = this.config[section] || [];
    const fields = this._fieldsFor(section);
    const addLabel = this._addLabelFor(section);

    container.innerHTML = `
      <div class="creator-list">
        ${items.map((item, i) => this._renderCard(section, item, i, fields)).join("")}
      </div>
      <button class="creator-btn creator-btn--add" id="addItem">+ ${addLabel}</button>
    `;

    container.querySelectorAll(".creator-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.config[section].splice(idx, 1);
        this._saveConfig();
        this._renderList(container, section);
      });
    });

    container.querySelector("#addItem")?.addEventListener("click", () => {
      this.config[section].push(this._emptyItem(section));
      this._saveConfig();
      this._renderList(container, section);
      container.querySelector(".creator-list")?.lastElementChild?.scrollIntoView({ behavior: "smooth" });
    });

    container.querySelectorAll("[data-section]").forEach((el) => {
      el.addEventListener("change", () => {
        const idx = parseInt(el.dataset.idx, 10);
        const field = el.dataset.field;
        this._updateItem(section, idx, field, el.value);
      });
    });
  }

  _renderCard(section, item, i, fields) {
    const fieldHtml = fields
      .map((f) => {
        const val = this._esc(Array.isArray(item[f.key]) ? item[f.key].join(", ") : item[f.key] || "");
        const tag = f.long ? "textarea" : "input";
        const attrs = `class="creator-input${f.long ? " creator-textarea-inline" : ""}"
                       data-section="${section}" data-idx="${i}" data-field="${f.key}"
                       placeholder="${f.label}"`;
        if (f.long) {
          return `<label class="creator-label">${f.label}</label><textarea rows="2" ${attrs}>${val}</textarea>`;
        }
        return `<label class="creator-label">${f.label}</label><input ${attrs} value="${val}" />`;
      })
      .join("");

    return `
      <div class="creator-card">
        <div class="creator-card-header">
          <span class="creator-card-title">${this._esc(item.name || item.title || item.key || `#${i + 1}`)}</span>
          <button class="creator-remove creator-remove-item" data-idx="${i}" title="Remove">✕</button>
        </div>
        ${fieldHtml}
      </div>`;
  }

  _fieldsFor(section) {
    const map = {
      factions: [
        { key: "id", label: "ID (no spaces)" },
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "alignment", label: "Alignment" },
        { key: "description", label: "Description", long: true },
      ],
      simulations: [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
        { key: "description", label: "Short description" },
        { key: "prompt", label: "Intro prompt shown to player", long: true },
      ],
      npcs: [
        { key: "id", label: "ID (no spaces)" },
        { key: "name", label: "Name" },
        { key: "role", label: "Role / Faction" },
        { key: "location", label: "Starting location" },
        { key: "traits", label: "Traits (comma-separated)" },
        { key: "arc", label: "Story arc" },
        { key: "background", label: "Background / GM notes", long: true },
      ],
      tallies: [
        { key: "key", label: "Tally key (snake_case)" },
        { key: "title", label: "Event title" },
        { key: "threshold", label: "Required votes" },
        { key: "description", label: "What triggered this" },
        { key: "effect", label: "World effect when triggered", long: true },
      ],
    };
    return map[section] || [];
  }

  _addLabelFor(section) {
    return {
      factions: "Add Faction",
      simulations: "Add Simulation",
      npcs: "Add NPC",
      tallies: "Add Tally Event",
    }[section] || "Add";
  }

  _emptyItem(section) {
    const blanks = {
      factions: { id: "", name: "New Faction", role: "", alignment: "neutral", description: "" },
      simulations: { id: "", name: "New Simulation", description: "", prompt: "" },
      npcs: { id: "", name: "New NPC", role: "", location: "", traits: [], arc: "", background: "" },
      tallies: { key: "", title: "New Event", threshold: 10, description: "", effect: "" },
    };
    return blanks[section] || {};
  }

  // ── Export tab ──────────────────────────────────────────────────

  _renderExport(container) {
    const isPreview = window.location.search.includes("preview=1");
    const previewKey = this._getPreviewKey();

    container.innerHTML = `
      <div class="creator-section">
        <p class="creator-section-title">Preview Mode</p>
        <p class="creator-hint-block">
          Launch an isolated test session — a fresh playthrough using a locked
          PREVIEW thread key. Your live game state is not affected.
        </p>
        ${
          isPreview
            ? `<div class="creator-preview-badge">PREVIEW MODE ACTIVE</div>
               <button class="creator-btn creator-btn--danger" id="exitPreview">Exit Preview</button>`
            : `<button class="creator-btn creator-btn--preview" id="launchPreview">Launch Preview Session</button>`
        }
        <p class="creator-hint-block">Preview key: <code class="creator-code">${previewKey}</code></p>
      </div>

      <div class="creator-section">
        <p class="creator-section-title">Export Theme JSON</p>
        <p class="creator-hint-block">
          Download your theme config as JSON. Give this file to a developer
          to update the server-side <code class="creator-code">theme.js</code>.
        </p>
        <button class="creator-btn" id="exportTheme">Download theme.json</button>
      </div>

      <div class="creator-section">
        <p class="creator-section-title">Import Theme JSON</p>
        <p class="creator-hint-block">Paste exported JSON below to load a theme config into the editor.</p>
        <textarea id="importTextarea" class="creator-textarea" rows="8" placeholder='{"id": "my-theme", ...}'></textarea>
        <div class="creator-row">
          <button class="creator-btn" id="importTheme">Load from JSON</button>
          <button class="creator-btn creator-btn--muted" id="resetTheme">Reset to Defaults</button>
        </div>
        <p id="importStatus" class="creator-hint-block"></p>
      </div>
    `;

    container.querySelector("#launchPreview")?.addEventListener("click", () => {
      this._launchPreview();
    });

    container.querySelector("#exitPreview")?.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("preview");
      url.searchParams.delete("thread");
      window.location.assign(url.toString());
    });

    container.querySelector("#exportTheme")?.addEventListener("click", () => {
      this._exportJSON();
    });

    container.querySelector("#importTheme")?.addEventListener("click", () => {
      const raw = container.querySelector("#importTextarea")?.value || "";
      const status = container.querySelector("#importStatus");
      try {
        const parsed = JSON.parse(raw);
        this.config = parsed;
        this._saveConfig();
        this._renderAll();
        if (status) status.textContent = "Theme loaded.";
      } catch (e) {
        if (status) status.textContent = `Parse error: ${e.message}`;
      }
    });

    container.querySelector("#resetTheme")?.addEventListener("click", () => {
      if (window.confirm("Reset to Unknown Signal defaults? This will discard your edits.")) {
        this._resetConfig();
      }
    });
  }

  _launchPreview() {
    this._saveConfig();
    const url = new URL(window.location.href);
    url.searchParams.set("thread", this._getPreviewKey());
    url.searchParams.set("preview", "1");
    url.searchParams.set("dev", "1");
    window.location.assign(url.toString());
  }

  _getPreviewKey() {
    let key = localStorage.getItem("unknown-signal-preview-key");
    if (!key) {
      key = "PREVIEW-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      localStorage.setItem("unknown-signal-preview-key", key);
    }
    return key;
  }

  _exportJSON() {
    const json = JSON.stringify(this.config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.config.id || "theme"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Top-level actions ───────────────────────────────────────────

  _bindTopActions() {
    const resetBtn = this._panelEl.querySelector("#creatorReset");
    resetBtn?.addEventListener("click", () => {
      if (window.confirm("Reset all creator settings to Unknown Signal defaults?")) {
        this._resetConfig();
      }
    });
  }

  // ── Preview mode badge ──────────────────────────────────────────

  /** Call from boot() to show PREVIEW badge if in preview mode */
  static applyPreviewBadge() {
    if (!window.location.search.includes("preview=1")) return;
    const topbar = document.querySelector(".terminal-topbar");
    if (!topbar) return;
    const badge = document.createElement("span");
    badge.className = "preview-badge";
    badge.textContent = "PREVIEW";
    topbar.insertBefore(badge, topbar.firstChild);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _bindValue(path, value) {
    const parts = path.split(".");
    let obj = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    this._saveConfig();
  }

  _updateItem(section, idx, field, value) {
    if (!this.config[section]?.[idx]) return;
    // Arrays stored as comma-separated strings
    if (field === "traits") {
      this.config[section][idx][field] = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (field === "threshold") {
      this.config[section][idx][field] = parseInt(value, 10) || 0;
    } else {
      this.config[section][idx][field] = value;
    }
    this._saveConfig();
  }

  _esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  _flash(btn, text) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = orig;
      btn.disabled = false;
    }, 1200);
  }
}

// ── Boot ─────────────────────────────────────────────────────────

window.creatorPanel = new CreatorPanel();

document.addEventListener("DOMContentLoaded", () => {
  // Only init if dev mode
  const params = new URLSearchParams(window.location.search);
  if (params.get("dev") === "1") {
    window.creatorPanel.init();
    CreatorPanel.applyPreviewBadge();

    // Wire the "Creator" toggle button in the dev panel header
    const toggleBtn = document.querySelector("#creatorToggle");
    const creatorEl = document.querySelector("#creatorPanel");
    toggleBtn?.addEventListener("click", () => {
      creatorEl?.classList.toggle("hidden");
    });
  }
});
