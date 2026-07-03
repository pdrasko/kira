# Kira Story — Memory

This file is the working memory for the `/story` skill. It is read at the
start of every story session and rewritten as the story grows. See
`.claude/skills/story/SKILL.md` for how it's maintained.

Structure: **Canon** never gets compressed. Everything else ages from
**Hot → Medium → Cold**, losing detail as it goes.

## Canon

Permanent facts that never change and never get compressed: setting,
protagonist, core cast, world rules, tone, format. Empty until the first
`/story` session establishes it.

- **Genre/tone**: horror / mystery, night, trapped, evidence of violence.
- **Setup**: Kira took a dare to go into the mansion — the reason the
  group is there at all. Now she and her five friends are trapped
  inside, at night, entrance door shut behind them and locked.
- **Protagonist**: Kira (matches project/repo name) — confirmed.
- **The five friends**: Alex, Shelly, Marcus, Jenna, and Tyler.
  No personalities assigned yet by design — plain names, characterized
  through the story as it goes rather than upfront.
- Interaction style established: hub-style room passages with
  "examine X" links that branch to a short description passage and
  link `Back` to the hub, rather than consuming the object or advancing
  plot on examination.
- Looking at a friend uses the same examine pattern, but the passage
  opens with a `!` header of their name (renders as `<h1>`) — a
  nameplate-style label above a one-line reaction, per author request.
  Keep these reactions light/neutral (no personality traits assigned)
  — just what they're doing/looking at in the moment.
- **Inventory system**: `$inventory` array, initialized empty in
  `StoryInit`. Collectible items use `$inventory.pushUnique('Item
  Name')` via a dedicated "Take X" passage, and a `StoryCaption`
  passage displays `Inventory: <list or (empty)>` in the UI bar,
  live-updating on navigation. Reuse this pattern for future pickups.
  SugarCube markup note: bold is `''text''`, not `**text**`
  (Markdown-style asterisks render literally, not as bold).
- **Found items (drawer beside the stairs, Entrance Hall)**: a box of
  wet matches (collectible), a storybook titled //The Hollow Choir// by
  in-world horror author Everett Marne (about a cult of seven who
  called something down and one survivor), and a hand-bound notebook
  with skull/plant illustrations and unrecognized symbols that read
  like instructions — implied occult/ritual content, not yet explained.

## Hot (recent, full detail)

- **Drawer** (reachable from the Entrance Hall, doesn't require going
  up the stairs first). Contains the wet matches, storybook, and
  notebook detailed in Canon above. Matches are the first item in
  `$inventory`; the books are read-only, no state change. Not yet
  referenced anywhere else in the story — open thread on whether/how
  the matches get used (something to light in the dark?) and whether
  the notebook's occult content connects to the claw marks/blood/cut
  cable from the Entrance Hall.
- **Stairs** (fork passage, just past the Entrance Hall). Kira goes up
  the (wooden) staircase **alone** — the five friends stay behind at the
  bottom, none willing to go first. A few steps up, a scream cuts
  through the house from back down below, right where she left them.
  Kira freezes, alone, and has to decide without anyone else. Two live
  branches currently exist — which one is canon going forward is an
  open author decision, not yet resolved:
  - **Upper Landing** (if "keep climbing"): staircase ends at a long
    hallway, doors shut on both sides, gone quiet again. Frontier of
    written content — no passage continues from here yet.
  - **Back Down The Stairs** (if "go back down and investigate"): Kira
    goes back down expecting to find the five exactly where she left
    them, but the entrance hall is empty — Alex, Shelly, Marcus, Jenna,
    and Tyler all gone. Not visible anywhere in the room. Room
    itself is physically unchanged (cut cable, broken chairs, locked
    steel door all as before) — only the five friends are missing.
    Frontier of written content — no passage continues from here yet.
  - Open thread: what/who screamed is still completely unresolved.
  - Open thread: the five friends' disappearance is now a central
    mystery on the "go back down" branch — no explanation given yet
    (did they go somewhere, get taken, or simply not come down with
    Kira at all?).
  - Open thread: need author direction on which branch to continue
    (or whether to develop both in parallel).

## Medium (earlier, summarized)

Older scenes compressed to a few sentences each: what happened, what
changed, what it set up.

- **Entrance Hall** (opening scene). Kira + five friends (Alex, Shelly,
  Marcus, Jenna, Tyler) trapped just inside a dark mansion at night,
  entrance door locked behind them. Room: dark gray stone, toppled
  bloodied/clawed furniture, a deliberately cut power cable, a locked
  steel door by the stairs, an unexplained "not empty"-feeling dark
  corner to the left (never entered — still unresolved, may be worth
  revisiting). Established the examine-hub interaction pattern and the
  friend-lookup-with-name-header pattern used throughout. Party chose
  to go up the stairs rather than explore the dark corner or force the
  steel door.

## Cold (distant past, compressed)

The oldest material, compressed to one or two lines per act/chapter —
just enough to keep continuity, not enough to reconstruct the scene.

- (none yet)

## Open Questions For The Author

Running list of unresolved story questions to raise next session.

- Which branch continues: Upper Landing (kept climbing) or Back Down
  The Stairs (went to investigate, friends now missing)? Or develop
  both?
- What/who screamed, if anything ever answers that?
- Where did Alex, Shelly, Marcus, Jenna, and Tyler go (Back Down
  branch)? Taken, hiding, never came down at all, something stranger?
- The dark corner in the Entrance Hall was never entered — revisit
  later, or leave as an unresolved red herring?
- Is the "something" behind the claw marks/blood a supernatural
  creature, a person, or left ambiguous for now?
