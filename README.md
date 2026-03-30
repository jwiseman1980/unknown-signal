# Unknown Signal Prototype

A static browser prototype for the first-contact experience:

- send someone a link and let them discover the signal
- open to a black terminal and blinking cursor
- wait for delayed contact
- profile their early responses
- optionally escalate into voice
- transition into Undertow

## Run it

Open [index.html](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\index.html) in a browser.

For best voice support, use a Chromium-based browser.

Or run a local site server with:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Open [index.html?dev=1](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\index.html?dev=1) to access authoring controls for:

- custom signal text
- contact mood
- channel target
- copy/share actions
- hidden profile readout
- share preview
- contact record and case files

## Share flow

Dev mode includes:

- `Share Signal` for native browser share when available
- `Copy Text Invite` to send a message plus link
- `Copy Link` for direct sharing
- `Open SMS Draft` to start a text message with the signal and link
- `Custom Signal` to tune the first-contact line before sharing
- `Channel Target` to wrap the same signal for web, SMS, or Slack style sharing

## Notes

- `The Echo` remains an internal/dev name for now and is intentionally hidden from the player-facing prototype.
- Default shared experience is intentionally minimal: a blinking cursor, delayed signal, and no visible setup UI.
- Voice uses browser speech APIs, not a backend yet.
- Trait inference is intentionally simple in this first cut.
- Query string `?signal=Your%20message` lets you customize the first-contact line.
- Query string `?dev=1` opens the authoring tools.
- See [CHANNEL_ADAPTATION.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\CHANNEL_ADAPTATION.md) for the multi-channel design rules.
- See [MEMORY_IDENTITY.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\MEMORY_IDENTITY.md) for the continuity model.
- See [SIMULATION_FRAMEWORK.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\SIMULATION_FRAMEWORK.md) and [CASE_MODEL.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\CASE_MODEL.md) for the core gameplay structure.
- See [PROFILES_RESIDUES.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\PROFILES_RESIDUES.md) for the player-pattern persistence model.
- See [DEPLOY.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\DEPLOY.md) for local hosting and public deployment options.
