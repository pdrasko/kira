---
name: story
description: Resume work on the Kira Story Twine game. Use when the user runs /story or asks to continue, write the next part of, or pick back up the interactive story in kira_story/. Reviews STORY_MEMORY.md, recaps where things stand, then interviews the user to write the next passage(s).
---

# /story — continue Kira Story

Kira Story is a SugarCube Twine game that lives at `kira_story/`:

- `kira_story/src/story.tw` — the actual Twee3 source. This is the story.
- `kira_story/STORY_MEMORY.md` — recursive summary used to resume quickly
  without re-reading the whole source every session.
- `kira_story/Makefile` — `make build` compiles `src/story.tw` into
  `kira_story/index.html` (the playable file GitHub Pages serves).

Follow this loop every time `/story` runs.

## 1. Load memory, don't reread everything

Read `kira_story/STORY_MEMORY.md` first. That's the primary source for
"where did we leave off" — it's specifically maintained so you don't have
to re-read the entire `.tw` source each session. Only open `src/story.tw`
directly if the Hot section is thin, or if you need to check exact wording
of the passage the reader will resume from.

## 2. Recap, then ask — don't just wait for instructions

Give a short recap (2-5 sentences) pulled from Canon + Hot: where the
protagonist is, what just happened, what's unresolved. Skip Medium/Cold
detail in the recap unless it's directly relevant.

Then actively lead: ask 1-3 concrete questions to move the story forward.
Check the "Open Questions For The Author" list in memory first — use those
if present. Prefer specific questions over generic ones ("Does Kira
confront her sister now, or does she read the letter first?" beats "what
happens next?"). This mirrors how the story was kicked off originally:
the author supplies decisions and color, you supply structure, prose, and
the connective tissue.

## 3. Write the passage(s)

Write new content directly into `kira_story/src/story.tw` as Twee3
passages (`:: PassageName` headers, `[[Link Text->Target]]` links,
SugarCube macros as needed). Keep prose in the author's voice as
established in Canon/Hot — ask if unsure rather than guessing on
something that would be hard to walk back later (character voice, a
death, a major reveal).

## 4. Update STORY_MEMORY.md (recursive aging)

After writing, update the memory file:

1. Add what you just wrote to **Hot**, in full detail (scene beats, exact
   state the reader is left in, new open threads).
2. **Age Hot → Medium**: Hot should hold roughly the last 1-3 scenes. If
   adding the new entry pushes it over that, take the oldest Hot entry,
   compress it to a few sentences (what happened / what changed / what it
   set up), and move it to the top of Medium. Delete it from Hot.
3. **Age Medium → Cold**: Medium should hold roughly the last 5-8
   entries. If it overflows, take the oldest 2-3 Medium entries, merge and
   compress them into a single one-or-two-line Cold entry (per
   act/chapter, not per scene), and move it to Cold. Delete them from
   Medium.
4. Cold entries never get compressed further — they're already at the
   floor. If Cold grows very large (10+ lines), you may merge adjacent
   Cold entries that cover the same act, but don't lose named plot
   points, character deaths, or irreversible decisions at any tier —
   compress prose, not facts.
5. Update **Canon** only for genuinely permanent facts (new named
   character, a world rule, a tone shift the author confirms). Canon is
   never compressed or removed.
6. Update **Open Questions For The Author** with anything you deliberately
   punted on.

## 5. Build, commit, hand back for a trial

Run `make -C kira_story build` to recompile `index.html`. Commit both the
`.tw` source change and the memory update (and the rebuilt `index.html`)
together with a descriptive message naming the scene/passages added.
Push to the working branch.

Then tell the user what to trial and how: pull/refresh the branch and
open `kira_story/index.html` locally, or — once merged — the GitHub
Pages URL. Point at the specific new passage(s) so they know what to
check. Don't keep writing indefinitely without checkpointing; a "logical
interval" is roughly one scene or one meaningful branch point, not one
line.

## Notes

- Don't compile by hand — always use `make -C kira_story build`, which
  pins the SugarCube story format version and caches it locally
  (gitignored under `kira_story/build/tools`).
- If `STORY_MEMORY.md` is still all "(none yet)" (no Canon set), this is
  the first real session — run the founding interview instead of assuming
  continuity: genre/tone, protagonist, setting, how much branching vs.
  linear narrative, and format preferences. Write the answers straight
  into Canon before writing any passages.
