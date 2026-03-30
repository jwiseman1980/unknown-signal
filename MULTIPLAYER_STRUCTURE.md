# Multiplayer Structure

This document defines how solo play, linked friend play, and asynchronous overlap should work together.

The goal is not to turn the project into a lobby shooter or a conventional co-op RPG.
The goal is to let players:

- hop in alone and develop their thread
- feel the residue of other people even when solo
- occasionally link up with friends to accomplish things the Signal does not want solved by one voice

## Core Principle

Solo play grows the thread.
Group play knots threads together.

The world should feel alive whether one person is present or several.

## Modes Of Presence

### 1. Solo Presence

The player enters alone.

They can:

- continue a personal case
- explore a district
- inspect traces
- shape their current session-instance
- influence factions and local world state

Solo play is the default.
It should always feel meaningful.

### 2. Asynchronous Presence

The player is alone, but the world is not.

They can encounter:

- traces left by other contacts
- prior session labels
- residual policy or faction drift
- clues created by someone else's old case
- a manifestation shaped by another player's session-instance

This is the main way the world feels populated between live sessions.

### 3. Linked Presence

Two or more players intentionally link up for a shared situation.

This can happen through:

- a shared invite or code
- a friend joining a specific case
- the Signal explicitly asking for another voice

Linked presence should be rarer and higher pressure than solo play.

## When The Signal Wants More Than One Person

The Signal should not ask for multiple people immediately.
That has to feel earned.

Good triggers:

- contradiction the Signal cannot reduce cleanly
- authority questions that need group witness
- trust problems
- loyalty splits
- situations where one answer is too easy alone

Example language:

- `This cannot be resolved cleanly alone.`
- `Bring another voice.`
- `I need contradiction.`
- `This problem changes when witnessed.`

## Multiplayer Activities

The strongest shared activities are not generic quests.
They are pressure situations that become more revealing when multiple people are involved.

Examples:

- shared simulations
- district expeditions
- rescue attempts
- faction negotiations
- safe-zone decisions
- confronting a dangerous session-instance
- retrieving or suppressing a trace

## Safe Zones And Group Play

Safe zones are good places to gather.

They can support:

- regrouping
- reviewing case files
- comparing traces
- deciding whether to trust another player
- preparing for a group simulation or district push

They should still feel fragile.

## Session Instances In Multiplayer

Every play session creates one persistent session-instance.

That means multiplayer does not only involve live players.
It can also involve:

- a friend's current live session
- a friend's prior session residue
- your own older session traces
- mixed situations where not every participant is fully live

This keeps the world socially dense even when few people are online at the same time.

## Group Discovery Rules

Players should not always know exactly what kind of presence they are dealing with.

Sometimes they are clearly with:

- a live friend
- a linked current contact

Sometimes they should only infer that another presence is:

- an older session-instance
- a residue of someone real
- a Signal-shaped manifestation of prior behavior

This preserves mystery while still allowing social play.

## MVP Linked Play

The first useful multiplayer scaffold is small.

### Step 1

Allow one player to create a linked thread or invite code.

### Step 2

Allow another player to join that thread.

### Step 3

Record both contact/session labels in the same group record.

### Step 4

Use that shared thread later to trigger:

- a shared simulation
- a linked case
- a trace that only appears because of the pairing

This is enough to begin testing the group concept.

## What To Avoid

- forcing group play as the main experience
- making solo play feel incomplete
- flattening the Signal into a normal party-game host
- requiring real-time coordination for all meaningful progress
- making every friend interaction overt and literal

## Litmus Test

Linked play is working if:

- solo sessions still feel rich
- group sessions feel qualitatively different, not just busier
- other people are felt in the world even when absent
- the Signal learns differently from one voice and from many voices
