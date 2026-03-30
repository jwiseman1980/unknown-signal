# Channel Adaptation

This project starts as a browser terminal, but the core experience should be portable.

The important thing is not the platform.
The important thing is the contact pattern.

## Canonical Base

The web terminal is the canonical first vessel.

Why:

- strongest control over pacing
- easiest place to establish mystery
- supports delayed contact and voice escalation
- neutral enough to adapt into other channels later

Every other channel should preserve the spirit of the terminal version.

## What Must Stay True Across Channels

- the Signal arrives simply
- the first interaction is small
- the experience feels personal before it feels explained
- the player is never told too much too early
- the name `The Echo` remains hidden at first
- the Signal interprets the player, not just their literal words
- the channel is a vessel, not the identity of the system

## Channel Roles

### Web

Best for:

- first discovery
- delayed pacing
- blinking prompt
- voice escalation
- simulations

Tone:

- sparse
- cinematic
- discoverable

### SMS

Best for:

- intimate first contact
- short strange openers
- follow-up nudges
- returning players to the main terminal or simulation

Tone:

- human enough to answer
- slightly unfinished
- concise

Guideline:

SMS should probably not carry the full experience by itself at first.
It should act as the knock on the door.

### Slack

Best for:

- group contact
- workplace or friend-group weirdness
- introducing multi-person simulations
- observing disagreement in a shared thread or channel

Tone:

- less intimate than SMS
- more social
- more aware of group dynamics

Guideline:

Slack works best once the Signal already knows how to ask for multiple voices.

## Recommended Evolution Path

1. Web terminal proves the tone.
2. SMS becomes the invitation layer.
3. Slack or Discord becomes the shared/group scenario layer.

This keeps the system coherent and lightweight.

## Channel-Specific Behaviors

### Web Behaviors

- delayed first line
- blinking cursor
- hidden tooling
- optional voice access
- richer simulation flow

### SMS Behaviors

- one short opener
- one follow-up if answered
- link back to the terminal when the experience deepens
- minimal formatting

Good SMS opener examples:

- `hello`
- `can i ask you something strange?`
- `i think this was meant for you.`
- `you should probably close this.`

### Slack Behaviors

- short threaded prompts
- invite another voice
- ask the group to disagree
- surface conflict and interpretation

Good Slack use cases:

- `I need more than one answer.`
- `Do not agree too quickly.`
- `Choose who speaks first.`

## Design Rule

Do not redesign the Signal for each platform.

Wrap one Signal in different communication skins.

That means:

- one voice
- one moral core
- one memory model
- many vessels

## Short Summary

Web is the room.
SMS is the knock.
Slack is the argument.
