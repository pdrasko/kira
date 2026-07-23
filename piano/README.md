# Piano Study Guide

A Duolingo-style piano practice app: a lesson path with chapters and stars, a
free-play repertoire, MIDI recording, live sheet-music-synced practice with a
virtual keyboard, a metronome, an in-staff mistake overlay, and progress
stats. No build step — open `index.html` (or visit
**https://pdrasko.github.io/kira/piano/**) and it runs.

## Try it

- **A real USB-MIDI keyboard/controller is required to make progress.**
  The on-screen keyboard is a *display only* — it lights up to show what's
  expected and what's being played, but clicking/tapping it does nothing;
  it deliberately cannot advance a lesson, score an attempt, or record a
  note. This is the same approach as `../midi_keyboard/`: real Web MIDI
  input, nothing simulated. The app tries to connect automatically on
  load (Chrome/Edge on desktop or Android — Web MIDI isn't available on
  iOS); a small icon in the header (hover/tap for detail) and a banner on
  the Player/Record screens show connection status and offer a manual
  **Connect MIDI** button.
- **Path** has a 2-chapter, 10-lesson built-in curriculum. Chapter 1,
  "Starter Studies," mirrors the topic order of PianoNanny.com's well-known
  free 8-lesson beginner course — keyboard orientation, black keys/sharps,
  note reading, time signature, tempo, sight-reading, finger exercises,
  then a full song that puts it together — with original exercises (see
  "Digitizing sheet music" below for why). Chapter 2 adds two full
  melodies. Lessons unlock in order once the previous one earns at least
  one star.
- **Repertoire** is the same songs playable freely, no lesson gate.
- **Record** captures your own playing (notes + timing, not audio) so you
  can practice it back later through the same engine as any other song.
- **Stats** shows XP/level, streak, a 12-week practice calendar, and an
  accuracy/tempo-consistency trend chart per song.
- There's no Start/Stop button — opening a lesson, Repertoire song, or a
  saved recording drops you straight into practicing. Wherever the cursor
  sits is simply the next note it's waiting for; play it (or, for a
  chord, all of them) and the cursor advances. Reaching the end (of the
  loop, or the whole piece if there's no loop) scores that pass and
  immediately starts the next one from the top — practice just keeps
  cycling for as long as you're on the screen.
- Every lesson also has a **▶ Preview** button that auto-plays the piece
  once — cursor moving, keyboard lighting up, synth sounding — with no
  input needed and no attempt recorded, so you can hear/see what a piece
  sounds like. It pauses the continuous practice loop while it plays and
  picks practice back up from the top the moment it's done (or you stop
  it early).
- Tempo, loop range, and the metronome all live behind the **⋮** button
  at the top of the player screen, hidden by default so nothing but the
  sheet music, keyboard, and Preview compete for attention while you're
  actually practicing — open it to configure, close it (click outside)
  and it's out of the way again.
- **Double-click a measure** in the sheet music to build a loop for
  isolating a hard passage, without opening the Settings menu at all —
  double-click again to remove it, double-click an adjacent measure to
  extend the loop by one, and double-click the clef to loop the whole
  piece. A soft purple band shows the selection right on the staff. This
  is just a faster way to set the same loop range the Settings menu's
  manual measure inputs control — both stay in sync with each other.

## How practicing works

There's a single, always-on way to practice, aware of an optional bar-range
loop for isolating a hard passage: the cursor never advances until you play
the correct note (or, for a chord, all of them). Wrong notes are logged as
mistakes but don't advance the piece, so you can take a passage at whatever
pace you need — there's no session to start or stop, no tempo-clock mode
that moves on without you.

Reaching the end of the loop region (or the whole piece, if there's no
loop) scores that pass as an Attempt — the same accuracy/stars/XP/mistake
tracking as before — and the engine immediately jumps back to the top and
starts the next pass, on its own. Setting or changing a loop (via the
Settings menu or double-clicking measures) takes effect live, mid-practice,
no restart needed.

The one exception is **▶ Preview**, a separate, non-interactive mode: it
plays the piece back on a tempo clock — notes emitted on the shared note
bus so the synth and keyboard react exactly as if you'd played them — with
no scoring and no Attempt recorded, purely a listen-along. It pauses the
continuous practice loop above while it runs and hands back control (from
the top of the loop/piece) the moment it finishes or is stopped.

Recurring mistakes (3+ misses at the same note) don't surface as a separate
text panel — they recolor that note's actual notehead in the sheet music
itself, in a soft pastel color, right where you're already looking. A small
🎨 icon at the top of the screen toggles this overlay on/off; it's on by
default and works the same way whether you got there through a Starter
Studies lesson or picked a song from Repertoire. Under the hood,
`sheetmusic.js` maps a source `Note` to its on-screen SVG via OSMD's
`GraphicalNote.FromNote()` + `getNoteheadSVGs()` and recolors it directly —
OSMD's own "coloring mode" feature colors every note of a given pitch class
alike (Boomwhacker-style), not arbitrary individual notes, so it doesn't fit
this.

## Architecture

Everything is vanilla ES modules, no bundler:

```
js/
  db.js              storage abstraction (see "Data model" below)
  events.js          append-only interaction log
  models.js           entity factories (the closest thing to a schema)
  seed-catalog.js     built-in chapters/lessons/songs (hand-authored MusicXML)
  musicxml-builder.js tiny helper to author MusicXML without hand-typing it
  note-bus.js         single pub/sub for "note on/off", regardless of source
  midi.js             Web MIDI input -> note-bus (the only real input source)
  keyboard.js          read-only virtual keyboard: note-bus -> highlight states,
                       never the other way around (no click-to-play)
  synth.js            WebAudio synth so silent MIDI controllers / demo preview
                       / played-back recordings are actually audible
  metronome.js         WebAudio lookahead-scheduled metronome
  sheetmusic.js         OpenSheetMusicDisplay wrapper: cursor stepping,
                       expected-notes-under-cursor, measure jump/loop,
                       recoloring specific noteheads for the mistake overlay,
                       measure hit-testing + the loop-region overlay band
  loop-selection.js     pure state machine for the double-click-to-loop
                       gesture (head/tail-only add/remove, bisect clears)
  piano-roll.js         canvas fallback "sheet music" for freehand recordings
  practice-engine.js    PracticePlayer: continuous wait-then-advance loop,
                       auto-restarting laps, scoring, ▶ Preview's demo mode
  mistakes.js           cross-attempt mistake tally -> problem-note markers
  recorder.js           MIDI recorder + RecordingCursor (same interface as
                       sheetmusic.js's renderer, so recordings are practiceable
                       through the identical engine)
  stats.js              XP/level/streak/daily-goal math + chart data prep
  catalog.js            chapter/lesson ordering + linear unlock rule
  app-state.js          current-profile pointer
  router.js             tiny hash router
  app.js               entry point / screen wiring
  screens/*.js          one render function per screen
vendor/
  opensheetmusicdisplay.min.js   vendored OSMD build (BSD-3, see OSMD-LICENSE.txt)
```

`SheetMusicRenderer` (sheetmusic.js) and `RecordingCursor` (recorder.js)
both implement the same small interface — `atEnd()`, `currentMeasureIndex()`,
`reset()`, `next()`, `jumpToMeasure()`, `expectedNotes()`,
`currentDurationBeats()` — so `PracticePlayer` doesn't know or care whether
it's driving a MusicXML score or something you played into the recorder
five minutes ago.

**Cache-busting**: `index.html` uses an import map (same technique as the
repo root's `index.html`) remapping every `./js/*.js` specifier to a
`?v=N`-suffixed URL — without it, a deployed change to any of these ~28
modules can keep being served from a stale browser/CDN cache indefinitely,
since none of them are otherwise versioned. **Bump every `v=N` in that
import map** (a single find-and-replace in `index.html`) whenever pushing
a change to anything under `js/`.

## Data model & the path to a cloud backend

Everything lives in `localStorage` today (namespaced under `kira.piano.v1.*`),
but the shape is deliberately backend-shaped already:

- Every record has an `id` (uuid), `createdAt`/`updatedAt`, a monotonic
  `_rev` counter, and a `_dirty` flag — the hooks a future sync layer needs
  for last-write-wins or conflict detection, without every entity's day-to-day
  shape changing.
- All reads/writes go through `StorageAdapter` (`db.js`) — `getAll` / `put` /
  `delete` / `clear`. `LocalStorageAdapter` is the only implementation today;
  swapping in e.g. a `RestApiAdapter` or a Supabase/Firebase adapter that
  implements the same three methods is the entire migration. `Repository`
  and every screen that calls `db.songs`, `db.attempts`, etc. stay
  unchanged — a stubbed-out `RestApiAdapter` sketch is commented in `db.js`.
- The interaction log (`events.js`) is append-only by design: every note
  played, mistake made, lesson started/finished, and navigation gets logged
  with a timestamp and session id — nothing analyzes it today beyond the
  in-app charts, but it's all there for offline analysis (`exportEventsAsFile()`
  downloads the whole log as JSON) or, later, batched upload to a real
  analytics/event pipeline (`flush()` is stubbed for exactly that).
- Collections: `profiles`, `chapters`, `lessons`, `songs`, `studyPlans`,
  `attempts`, `recordings`, `mistakeStats`, `practiceSessions`, `settings` —
  each maps naturally to a table were this backed by a real database.

## Sheet music: built-in library + "pull from an open-source provider"

Live-fetching a third-party sheet-music service (e.g. MuseScore's open
scores, IMSLP) from a static, no-backend GitHub Pages app isn't reliable —
most of those aren't CORS-enabled for direct browser fetches, and would need
a server-side proxy this app doesn't have. Two things stand in for that
today, sharing one seam:

1. **Built-in library** (`seed-catalog.js`) — ten public-domain/original
   pieces, hand-authored as MusicXML via `musicxml-builder.js`.
2. **Import** (Profile → "Add sheet music") — drop in any uncompressed
   `.musicxml`/`.xml` file (e.g. exported from an open-source notation tool,
   or downloaded from an open sheet-music library) and it's added to your
   Repertoire as a normal `Song` record.

Both populate the exact same `Song.musicXml` field. Wiring up a live
provider later is a matter of adding another function with that same
shape (fetch → return a MusicXML string) — not a redesign.

The Chapter 1 "Starter Studies" lessons were modeled after PianoNanny.com's
8-lesson beginner course *topic order*, not its actual images: pianonanny.com
returns HTTP 403 to automated fetches (confirmed both from this app's build
environment and via the WebFetch tool), so there was never anything of
theirs available to "digitize" — the exercises in `seed-catalog.js` are
original transcriptions of the same pedagogical progression. If you have
saved copies of the real PianoNanny pages/images, they can be transcribed
by hand into `musicxml-builder.js`-style note lists and swapped in.

## Known simplifications (MVP scope)

- Scoring is pitch + attack-timing based; note duration/legato and
  velocity aren't scored.
- The lesson unlock rule is linear (any 1+ star unlocks the next lesson) —
  no branching paths yet.
- `.mxl` (compressed MusicXML) import isn't supported, only uncompressed
  `.musicxml`/`.xml` — unzip first.
- The Duolingo-style path alternates two columns; it doesn't yet do a full
  serpentine layout with connecting line art.
- There is intentionally no keyboard/mouse input fallback for practice or
  recording — a real MIDI device is required. Development/testing without
  hardware simulates it by calling `note-bus.js`'s `emitNoteOn`/`emitNoteOff`
  directly (exactly what `midi.js` does for a real MIDI message).
