# Marko Story — Memory

This file is the working memory for the `/story` skill. It is read at the
start of every story session and rewritten as the story grows. See
`.claude/skills/story/SKILL.md` for how it's maintained.

Structure: **Canon** never gets compressed. Everything else ages from
**Hot → Medium → Cold**, losing detail as it goes.

## Canon

- **Protagonist**: Marko, a cat. At the very start (`Start` passage) the
  reader picks Marko's age — kitten / young / adult / old, stored in
  `$age` / `$ageDesc`. Flavor only: it colors prose and voice, does not
  change mechanics or branching.
- **Setting**: urban rooftops and alleys. Marko's family lives on a
  rusted fire escape three floors above an alley.
- **Family**: father **Alex**, an orange tabby; mother **Bella**, a
  red-and-black cat; littermate **Poofball**, a young male kitten with
  reddish-black stripes on white fur (other littermates unnamed).
- **Inciting incident**: a pigeon startles the family; Marko loses his
  footing and falls from the fire escape, landing in the alley below,
  separated from his mother and littermates. Family's fate is left
  open/unconfirmed (not narrated as dead) — the throughline is Marko
  trying to reunite or find a new place in the world.
- **Tone**: adventurous, high-stakes survival CYOA. Real dangers, choices
  with real consequences (including bad/tragic endings), not just a cozy
  romp.
- **Branching**: heavy — lots of divergent paths and multiple distinct
  endings intended.
- **Format**: SugarCube 2, second person present tense ("You are
  Marko..."), same toolchain/build as `kira_story`.

## Hot (recent, full detail)

- **Opening scene, just written (Start → WakeUp).** Passages: `Start`
  (age picker) → `AgeKitten`/`AgeYoung`/`AgeAdult`/`AgeOld` (set `$age`,
  `$ageDesc`) → `Rooftop` (establishes father Alex, mother Bella, and
  littermates including Poofball on the fire escape; a pigeon bursts
  from a bakery vent, everyone startles) → `Fall` (Marko falls past the
  fire escape landings, hears Bella and Alex call out, hits a garbage
  bag/cardboard, blacks out) → `AlleyLanding` (wakes dazed, calls for
  Mom/Dad/Poofball, no answer, no way back up; **first real choice**:
  shelter under dumpster / behind crates / in a cardboard box — three
  short flavor passages, `ShelterDumpster`/`ShelterCrates`/`ShelterBox`,
  all reconverge) → `Asleep` (exhausted, dreams of the fire escape) →
  `WakeUp` (wakes at dawn, alley empty, starts walking, finds a door
  propped open with warm air/cooking smell coming through).
  **Left off**: `WakeUp` ends on the door as a cliffhanger — no
  outgoing link yet. This is the natural spot for the next, bigger
  branch point (whether to push through the door, what's on the other
  side, who/what Marko meets next).

## Medium (earlier, summarized)

- (none yet)

## Cold (distant past, compressed)

- (none yet)

## Open Questions For The Author

- What's behind the door? (a person's home, another animal's den, a
  restaurant kitchen, something stranger?) This is the first big
  branch point given the heavy-branching preference, so worth deciding
  deliberately rather than improvising alone.
- Should Marko's family ever be confirmed alive/found, or is at least
  one ending meant to leave them lost for good?
- Are there other named littermates besides Poofball, or does he stay
  the only one singled out by name?
