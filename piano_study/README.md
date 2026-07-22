# Piano Study Guide

A Duolingo-style piano practice app: a lesson path with chapters and stars, a
free-play repertoire, MIDI recording, live sheet-music-synced practice with a
virtual keyboard, a metronome, mistake tracking with hints, and progress
stats. No build step — open `index.html` (or visit
**https://pdrasko.github.io/kira/piano_study/**) and it runs.

## Try it

- Play the on-screen keyboard with clicks/taps, or plug in a real MIDI
  keyboard/controller (Chrome/Edge on desktop or Android — Web MIDI isn't
  available on iOS) and connect it from **Profile → Connect MIDI device**.
- **Path** has a 2-chapter, 5-lesson built-in curriculum (a C major scale
  and five-finger warm-up, then three full melodies). Lessons unlock in
  order once the previous one earns at least one star.
- **Repertoire** is the same songs playable freely, no lesson gate.
- **Record** captures your own playing (notes + timing, not audio) so you
  can practice it back later through the same engine as any other song.
- **Stats** shows XP/level, streak, a 12-week practice calendar, and an
  accuracy/tempo-consistency trend chart per song.

## How practicing works

Two modes, both aware of an optional bar-range loop for isolating a hard
passage:

- **Wait for note** — the cursor never advances until you play the
  correct note (or, for a chord, all of them). Wrong notes are logged as
  mistakes but don't advance the piece, so you can take a passage at
  whatever pace you need.
- **Performance** — tempo/metronome-driven; the cursor advances on a
  clock regardless of what you play, scoring how close each note landed to
  the beat. This is what tempo-consistency measures.

Recurring mistakes (3+ misses at the same note/measure) surface as a hint
with a one-click "practice this section" button that sets up a loop around
the trouble spot in wait mode.

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
  midi.js             Web MIDI input -> note-bus
  keyboard.js          virtual on-screen keyboard -> note-bus, + highlight states
  synth.js            WebAudio synth so silent MIDI controllers / the virtual
                       keyboard / played-back recordings are actually audible
  metronome.js         WebAudio lookahead-scheduled metronome
  sheetmusic.js         OpenSheetMusicDisplay wrapper: cursor stepping,
                       expected-notes-under-cursor, measure jump/loop
  piano-roll.js         canvas fallback "sheet music" for freehand recordings
  practice-engine.js    PracticePlayer: wait/performance modes, looping, scoring
  mistakes.js           cross-attempt mistake tally + hint generation
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

1. **Built-in library** (`seed-catalog.js`) — five public-domain pieces,
   hand-authored as MusicXML via `musicxml-builder.js`.
2. **Import** (Profile → "Add sheet music") — drop in any uncompressed
   `.musicxml`/`.xml` file (e.g. exported from an open-source notation tool,
   or downloaded from an open sheet-music library) and it's added to your
   Repertoire as a normal `Song` record.

Both populate the exact same `Song.musicXml` field. Wiring up a live
provider later is a matter of adding another function with that same
shape (fetch → return a MusicXML string) — not a redesign.

## Known simplifications (MVP scope)

- Scoring is pitch + attack-timing based; note duration/legato and
  velocity aren't scored.
- The lesson unlock rule is linear (any 1+ star unlocks the next lesson) —
  no branching paths yet.
- `.mxl` (compressed MusicXML) import isn't supported, only uncompressed
  `.musicxml`/`.xml` — unzip first.
- The Duolingo-style path alternates two columns; it doesn't yet do a full
  serpentine layout with connecting line art.
