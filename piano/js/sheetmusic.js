// Thin wrapper around the vendored OpenSheetMusicDisplay (OSMD, BSD-3
// licensed — see vendor/OSMD-LICENSE.txt) build. OSMD renders MusicXML and
// ships a "cursor" API purpose-built for exactly what we need: stepping
// through the score note-by-note/chord-by-chord and knowing which notes
// are under the cursor right now, which is what drives both the sheet
// music highlighting and the "which key(s) to press next" signal sent to
// the virtual keyboard.
//
// OSMD's `Pitch.Octave` is NOT the MusicXML octave — it's shifted by an
// internal constant (`Pitch.OctaveXmlDifference`, 3 in the vendored build),
// confirmed empirically: a MusicXML `<octave>4</octave>` (middle C) comes
// back as `Pitch.Octave === 1`. Rather than replicate that internal
// bookkeeping, `Pitch.getHalfTone()` already folds fundamental note +
// accidental + octave into one number — and algebraically,
// standard MIDI note number = getHalfTone() + 12 (verified against a
// rendered middle C: getHalfTone() returned 48, and MIDI middle C is 60).
function pitchToMidi(pitch) {
  return pitch.getHalfTone() + 12;
}

export class SheetMusicRenderer {
  constructor(container) {
    this.container = container;
    const OSMD = window.opensheetmusicdisplay.OpenSheetMusicDisplay;
    this.osmd = new OSMD(container, {
      backend: 'svg',
      drawingParameters: 'compacttight',
      // `autoResize: true` wires OSMD to a ResizeObserver that re-renders
      // the whole graphical sheet on container resize. Confirmed by direct
      // A/B test (isolated OSMD instance vs. one mounted the same way this
      // app does): with it on, the cursor's *iterator* keeps advancing
      // correctly on every next() (expectedNotes()/currentMeasureIndex()
      // stay right), but its on-screen <img> silently stops moving after
      // the first render — it desyncs from the graphical notes a resize
      // recomputed and never gets repositioned against them. Since nothing
      // here needs the sheet music to reflow on resize (the container
      // scrolls horizontally instead), this stays off rather than chasing
      // OSMD's internal resize/cursor interaction.
      autoResize: false,
    });
  }

  async load(musicXml) {
    await this.osmd.load(musicXml);
    this.osmd.render();
    this.cursor = this.osmd.Cursor || this.osmd.cursor;
    this.sheet = this.osmd.Sheet || this.osmd.sheet;
    this.cursor.show();
    this.cursor.reset();
  }

  get measureCount() {
    return this.sheet ? this.sheet.SourceMeasures.length : 0;
  }

  /** {beats, beatType} for the given 0-based measure index, defaulting to 4/4 if unavailable. */
  timeSignatureAtMeasure(measureIndex = 0) {
    const measure = this.sheet?.SourceMeasures?.[measureIndex];
    const ts = measure?.ActiveTimeSignature;
    if (ts) return { beats: ts.Numerator, beatType: ts.Denominator };
    return { beats: 4, beatType: 4 };
  }

  atEnd() {
    return !this.cursor || this.cursor.Iterator.EndReached;
  }

  /** 0-based, or null once past the last note. */
  currentMeasureIndex() {
    if (this.atEnd()) return null;
    return this.cursor.Iterator.CurrentMeasureIndex;
  }

  reset() {
    this.cursor.reset();
    this.cursor.show();
  }

  next() {
    if (this.atEnd()) return false;
    this.cursor.next();
    return true;
  }

  /** Resets to the start and steps forward to the first beat of the given 0-based measure. */
  jumpToMeasure(measureIndex) {
    this.cursor.reset();
    this.cursor.show();
    while (!this.atEnd() && this.currentMeasureIndex() < measureIndex) {
      this.cursor.next();
    }
  }

  /** MIDI note numbers under the cursor right now (chord-aware), skipping rests. An empty result at a non-end position means "rest — just advance". */
  expectedNotes() {
    if (this.atEnd()) return [];
    const notes = this.cursor.NotesUnderCursor();
    const midiNumbers = [];
    for (const note of notes) {
      if (!note || (note.isRest && note.isRest()) || !note.Pitch) continue;
      midiNumbers.push(pitchToMidi(note.Pitch));
    }
    return midiNumbers;
  }

  /** Duration of the notes under the cursor, in beats (quarter-note units assumed absent a time signature override). */
  currentDurationBeats() {
    if (this.atEnd()) return 1;
    const notes = this.cursor.NotesUnderCursor();
    const first = notes.find((n) => n && n.Length);
    if (!first) return 1;
    return first.Length.RealValue * 4;
  }

  scrollCursorIntoView() {
    const el = this.cursor?.cursorElement;
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  destroy() {
    this.cursor?.hide();
    this.container.innerHTML = '';
  }
}

/**
 * User-facing side of the "pull sheet music from an open-source provider"
 * requirement. Live-fetching arbitrary third-party libraries (MuseScore's
 * open scores, IMSLP, etc.) at runtime needs a CORS-friendly endpoint or a
 * server-side proxy this static, no-backend app doesn't have. Importing a
 * MusicXML/.mxl file the user already downloaded from one of those open
 * sources plugs into the exact same `Song.musicXml` field the built-in
 * catalog uses — swapping this for a live fetch later is a one-function
 * change, not a redesign.
 */
export async function importMusicXmlFile(file) {
  if (file.name.endsWith('.mxl')) {
    throw new Error('Compressed .mxl files need unzipping first — export as uncompressed .musicxml/.xml instead.');
  }
  return file.text();
}
