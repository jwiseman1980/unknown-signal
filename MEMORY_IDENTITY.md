# Memory And Identity

This project needs continuity.
The Signal should remember prior contact.
It should not feel like covert surveillance.

## Short Answer

Do not use IP address as the primary identity key.

It is weak technically and bad thematically.

Why:

- many people can share one IP
- one person can have many IPs
- mobile and home networks change often
- it feels closer to tracking than consented contact
- it makes the project feel less like a relationship and more like a dragnet

IP can still be used in a narrow, secondary way for anti-abuse or rate limiting.
It should not be the core memory of a person.

## Better Model

Use layered identity.

### 1. Contact Token

When someone first engages, the system creates a lightweight pseudonymous token.

This can live in:

- browser local storage
- a signed link token
- a generated contact ID

This becomes the main continuity handle for the Signal.

The player never needs a heavy account flow at the start.

## 2. Signal Memory File

Each contact token can have a memory record.

That record might store:

- first contact line used
- tone of engagement
- provisional contact number
- optional self-label if the contact resists the number
- emerging trait profile
- prior simulation choices
- unresolved scenarios
- phrases the Signal associates with this person
- whether they brought others in
- resonance level

This gives the feeling:

`it remembers me`

without implying:

`it secretly watched everything I did`

## 3. Shared World Memory

Separate the personal memory file from the public world trace.

Personal memory:

- private patterning
- prior conversations
- relationship with the Signal

Shared world memory:

- public consequences
- district changes
- rumor traces
- faction movement
- changes that affect other players

This keeps the braided-world structure intact.

## 4. Optional Stronger Identity Later

If needed later, people can choose a stronger way to persist contact:

- named account
- phone-based invite
- group thread identity
- linked device profile

But that should be optional and earned.
The early magic is in low-friction contact.

## Thematic Rule

The Signal should remember what was given to it.
It should not feel like it stole access.

That means:

- continuity through return
- continuity through consent
- continuity through participation

Not:

- continuity through hidden scraping
- continuity through invisible surveillance

## If You Still Want IP In The Mix

Use it carefully and only as a support signal.

Good uses:

- abuse prevention
- throttling
- rough regional context if explicitly needed
- suspicious duplicate traffic patterns

Bad uses:

- deciding who a person is
- building the main memory file
- making claims like `I know this is you`

## Best Practical Version

For the first real build:

1. Generate a contact ID on first interaction.
2. Store it locally in the browser.
3. Keep a small memory file keyed to that ID.
4. Let share links carry scenario or invitation context, not personal identity.
5. Keep public world state separate from private contact memory.

This gives us:

- persistence
- mystery
- ethical clarity
- lightweight implementation

## Identity Friction

The Signal can initially default to the contact number in a slightly abrasive way.

That is useful because:

- it feels clinical
- it creates friction
- objection becomes a story event

If the contact resists being treated as a number, the Signal can pivot:

- `Then tell me more about yourself.`
- `What should I call you?`
- `What part of that is real under pressure?`

This turns identity from profile metadata into a live exchange.

## In-World Feeling

The Signal should feel like it remembers prior contact because you came back.

Not because it hunted you down across the internet.

That difference matters a lot.
