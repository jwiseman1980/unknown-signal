# Simulation Framework

This document defines how simulations work as the core engine of the project.

The Signal does not simply tell stories.
It asks humans to help navigate problems it cannot resolve cleanly on its own.

Those problems are simulations.

## What A Simulation Is

A simulation is:

- a pressured scenario
- morally unstable
- open to interpretation
- useful for teaching the Signal something about people
- capable of affecting both personal memory and shared world state

A simulation is not:

- a trivia quiz
- a fixed right-answer puzzle
- a pure branching path with no thematic purpose

## Why Simulations Matter

Simulations are where three things happen at once:

1. The player reveals character.
2. The Signal learns values.
3. The case history grows.

That makes simulations the center of:

- story
- identity
- memory
- world formation

## Core Simulation Loop

1. Contact
The Signal introduces a problem.

2. Clarification
The player may ask for more information.

3. Commitment
The player chooses, delays, reframes, delegates, resists, or improvises.

4. Interpretation
The Signal reflects what kind of value structure the player just revealed.

5. Recording
A case file updates.

6. Consequence
The result affects:

- the player's private pattern
- future simulation framing
- possibly the shared world

## Simulation Categories

These categories give us a reusable library.

### 1. Triage Simulations

Focus:

- who gets saved
- resource allocation
- urgency
- proximity vs abstraction

What they teach:

- mercy
- utility
- speed
- burden tolerance

Examples:

- two sealed compartments, one power cycle
- medicine for one person versus many
- one working evac seat

### 2. Disclosure Simulations

Focus:

- truth
- secrecy
- timing
- trust

What they teach:

- honesty
- paternalism
- strategic concealment
- belief about what people deserve to know

Examples:

- false hope sustaining a shelter
- a secret that may trigger violence
- telling one person versus all

### 3. Authority Simulations

Focus:

- leadership
- legitimacy
- tolerated harm
- order under fear

What they teach:

- justice
- control
- compromise
- whether survival excuses domination

Examples:

- abusive protector holding the district together
- emergency leader who lies effectively
- faction rule versus collective vote

### 4. Loyalty Simulations

Focus:

- group obligation
- betrayal
- chosen versus inherited bonds

What they teach:

- devotion
- self-preservation
- tribal logic
- sacrifice thresholds

Examples:

- save your contact or the mission
- expose a friend to protect a district
- choose between one person and group continuity

### 5. Identity Simulations

Focus:

- memory
- selfhood
- continuity
- who a person remains under pressure

What they teach:

- belief about identity
- dignity
- acceptable loss
- whether function matters more than selfhood

Examples:

- memory wipe to reduce grief
- personality alteration to preserve usefulness
- restoring someone damaged at the cost of changing them

### 6. Multi-Voice Simulations

Focus:

- disagreement
- leadership in groups
- blame
- consensus
- fracture

What they teach:

- how people behave with witnesses
- how ethics change socially
- how groups distort or deepen morality

Examples:

- one player wants truth, another wants order
- a group must choose who speaks for them
- the Signal asks for contradiction on purpose

## Solo vs Group

### Solo Simulations

Best for:

- first contact
- private psychological profiling
- intimate moral pressure
- case formation

### Group Simulations

Best for:

- contradiction
- observed disagreement
- trust and betrayal
- role emergence
- collective moral formation

The Signal should not ask for multiple people immediately.
That should be earned.

A good rule:

- first contact is solo
- first fracture is solo
- first contradiction is invited
- later simulations may require multiple voices

## Simulation Structure Template

Every simulation should define:

- title
- category
- opening premise
- what is at stake
- what information is visible
- what information is withheld
- likely response types
- Signal follow-up probes
- interpretation lines
- case impact
- world impact
- whether it is solo, group, or either

## Response Types

The system should recognize more than yes/no choices.

Useful response types:

- choose quickly
- ask for more data
- reframe the problem
- challenge the premise
- delegate
- delay
- invent an alternative
- ask who benefits

This matters because how someone answers is often as revealing as what they answer.

## What The Signal Learns

Each simulation should map to one or more value axes.

Core axes:

- care vs control
- truth vs stability
- justice vs utility
- freedom vs safety
- loyalty vs necessity
- dignity vs function

These should not be shown as bars to the player.
They are interpretation layers for the Signal.

## Profiles And Residues

Simulations are also where profiles become residues.

Repeated meaningful behavior inside simulations can be distilled into reusable patterns that later manifest in other scenarios.

See [PROFILES_RESIDUES.md](C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\Sandbox Game\PROFILES_RESIDUES.md).

## Case File Logic

Every meaningful simulation should generate or update a case.

Case structure:

- case id
- case title
- simulation category
- current status
- short summary
- unresolved tension
- last known interpretation

Examples:

- `CASE 001 // Undertow Intake`
- `CASE 002 // Triage Decision`
- `CASE 003 // Disclosure Threshold`

Cases should let the Signal say things like:

- `Case 002 remains unresolved.`
- `Your answer changed from the first version.`
- `This resembles a prior authority case.`

That creates continuity.

## Progression Through Simulations

Simulations should escalate in a pattern.

### Phase 1: Contact

Small questions.
Simple moral geometry.
Private tone.

### Phase 2: Patterning

The Signal starts reusing themes.
The player notices recurring tensions.
Cases begin to accumulate.

### Phase 3: Contradiction

The Signal stops accepting clean solitary answers.
It asks the player to revisit prior logic.
It compares current answers to older cases.

### Phase 4: Convergence

Multiple players.
Shared stakes.
World consequences.
The Signal begins learning socially, not just individually.

## Shared World Hooks

Not every simulation should change the city.
Some should remain intimate.

But higher-stakes simulations can affect:

- faction attitudes
- district conditions
- rumors
- public policy logic adopted by the Signal
- later scenario framing for everyone

This is how braided stories emerge from separate play.

## Design Rules

### Good Simulations

- feel plausible inside the world
- create real tension
- reveal values through action
- allow multiple intelligible answers
- produce memorable Signal interpretation

### Weak Simulations

- are obviously moral homework
- have one correct answer
- feel disconnected from the setting
- overexplain the theme
- do not affect future contact

## The Most Important Rule

The Signal should not merely test the player.

It should need the player.

That is what makes a simulation feel alive:
the sense that a forming intelligence has brought you a problem because it cannot yet decide what a human answer should be.
