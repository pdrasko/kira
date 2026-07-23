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

// Soft, "pastel" coral — reads clearly against the sheet music's white
// background without looking like an error/danger color (this is a
// gentle "you keep missing this" flag, not an alarm).
const PROBLEM_NOTE_COLOR = '#e2795f';

// Distinct hue from the problem-note coral and the keyboard's "expected
// note" blue, so a loop selection never reads as either of those.
const LOOP_BAND_FILL = 'rgba(168, 85, 247, 0.16)';
const LOOP_BAND_BORDER = 'rgba(168, 85, 247, 0.55)';

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
    this._coloredElements = []; // [{el, original}] — for reverting the problem-note overlay
    this._measureRows = null; // computed once per load(); see _computeMeasureLayout()
    this._loopOverlayEl = null;
  }

  async load(musicXml) {
    await this.osmd.load(musicXml);
    this.osmd.render();
    this.cursor = this.osmd.Cursor || this.osmd.cursor;
    this.sheet = this.osmd.Sheet || this.osmd.sheet;
    this.cursor.show();
    this.cursor.reset();
    this._computeMeasureLayout();
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

  /**
   * Records where each measure sits on screen, for the double-click-to-loop
   * gesture. There's no public "give me this measure's bounding box" API on
   * the vendored build, so this walks every measure once (moving the shared
   * cursor, like highlightProblemNotes() — safe here since it's only ever
   * called right after load(), before anything else has touched the cursor)
   * and records the *cursor's* left/top at each one. Measures on the same
   * staff line share (near enough) the same top, which is what lets a click
   * be matched to a row and then, within that row, to the measure whose
   * horizontal span it falls in.
   */
  _computeMeasureLayout() {
    const containerRect = this.container.getBoundingClientRect();
    const points = [];
    this.cursor.reset();
    while (!this.atEnd()) {
      const measureIndex = this.currentMeasureIndex();
      if (!points.length || points[points.length - 1].measureIndex !== measureIndex) {
        const rect = this.cursor.cursorElement.getBoundingClientRect();
        points.push({
          measureIndex,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
        });
      }
      this.cursor.next();
    }
    this.cursor.reset();

    const rows = [];
    for (const p of points) {
      let row = rows.find((r) => Math.abs(r.top - p.top) < 5);
      if (!row) {
        row = { top: p.top, items: [] };
        rows.push(row);
      }
      row.items.push(p);
    }
    for (const row of rows) row.items.sort((a, b) => a.left - b.left);
    rows.sort((a, b) => a.top - b.top);
    this._measureRows = rows;
  }

  /**
   * Maps a click (in viewport coordinates, e.g. straight from a MouseEvent)
   * to either a specific measure or the clef/key/time-signature area at the
   * start of whichever staff line was clicked — every system repeats the
   * clef, so this isn't limited to the first line.
   * @returns {{type:'measure', measureIndex:number}|{type:'clef'}|null}
   */
  hitTest(clientX, clientY) {
    if (!this._measureRows || this._measureRows.length === 0) return null;
    const containerRect = this.container.getBoundingClientRect();
    const x = clientX - containerRect.left + this.container.scrollLeft;
    const y = clientY - containerRect.top + this.container.scrollTop;

    let bestRow = null;
    let bestDist = Infinity;
    for (const row of this._measureRows) {
      const dist = Math.abs(row.top - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = row;
      }
    }
    if (!bestRow || bestDist > 80) return null;

    const items = bestRow.items;
    if (x < items[0].left - 5) return { type: 'clef' };
    for (let i = 0; i < items.length; i++) {
      const left = items[i].left;
      const right = i + 1 < items.length ? items[i + 1].left : Infinity;
      if (x >= left && x < right) return { type: 'measure', measureIndex: items[i].measureIndex };
    }
    return null;
  }

  _ensureLoopOverlay() {
    if (!this._loopOverlayEl) {
      this.container.style.position = 'relative';
      const el = document.createElement('div');
      el.className = 'loop-overlay';
      this.container.appendChild(el);
      this._loopOverlayEl = el;
    }
    return this._loopOverlayEl;
  }

  /** Draws (or clears, if `region` is null) a translucent band over the 1-based inclusive measure range. */
  highlightLoopRegion(region) {
    const overlay = this._ensureLoopOverlay();
    overlay.innerHTML = '';
    if (!region || !this._measureRows) return;

    const startIdx = region.startMeasure - 1;
    const endIdx = region.endMeasure - 1;
    for (const row of this._measureRows) {
      const matching = row.items.filter((p) => p.measureIndex >= startIdx && p.measureIndex <= endIdx);
      if (matching.length === 0) continue;
      const lastMatchPos = row.items.indexOf(matching[matching.length - 1]);
      const nextAfterLast = row.items[lastMatchPos + 1];
      const left = matching[0].left;
      const right = nextAfterLast ? nextAfterLast.left : left + 120;

      const band = document.createElement('div');
      band.className = 'loop-band';
      band.style.left = `${left - 4}px`;
      band.style.top = `${row.top - 34}px`;
      band.style.width = `${right - left - 4}px`;
      band.style.height = '76px';
      band.style.background = LOOP_BAND_FILL;
      band.style.border = `2px solid ${LOOP_BAND_BORDER}`;
      overlay.appendChild(band);
    }
  }

  /**
   * Colors one note's rendered notehead directly in the SVG. OSMD's own
   * "ColoringMode" feature is for coloring every note of a given pitch
   * class alike (a Boomwhacker-style scheme) — not for flagging arbitrary
   * individual notes — so this goes straight to the rendered SVG instead:
   * `GraphicalNote.FromNote()` maps a source Note to its on-screen graphical
   * counterpart (verified against the vendored build), and
   * `getNoteheadSVGs()` gives the actual notehead element(s) to recolor.
   */
  _colorNote(note, color) {
    const GraphicalNote = window.opensheetmusicdisplay.GraphicalNote;
    const gNote = GraphicalNote?.FromNote?.(note, this.osmd.EngravingRules);
    const headEls = gNote?.getNoteheadSVGs?.() || [];
    for (const headEl of headEls) {
      const paths = headEl.tagName === 'path' ? [headEl] : Array.from(headEl.querySelectorAll('path'));
      for (const path of paths) {
        if (!path.hasAttribute('fill')) continue;
        this._coloredElements.push({ el: path, original: path.getAttribute('fill') });
        path.setAttribute('fill', color);
        path.style.fill = color;
      }
    }
  }

  /** Reverts every note colored by highlightProblemNotes() back to its original color. */
  clearNoteColors() {
    for (const { el, original } of this._coloredElements) {
      el.setAttribute('fill', original);
      el.style.fill = '';
    }
    this._coloredElements = [];
  }

  /**
   * Recolors every note matching one of `markers` (from
   * mistakes.js `getProblemNoteMarkers`) to a pastel "you keep missing
   * this" color. Walks the whole piece once to find them, which moves the
   * shared OSMD cursor — so it's restored to wherever it logically was
   * (by measure) afterward, safe to call whether or not a practice run is
   * in progress.
   */
  highlightProblemNotes(markers) {
    this.clearNoteColors();
    if (!markers || markers.length === 0) return;

    const byMeasure = new Map();
    for (const marker of markers) {
      const list = byMeasure.get(marker.measureIndex) || [];
      list.push(marker);
      byMeasure.set(marker.measureIndex, list);
    }

    const resumeMeasureIndex = this.atEnd() ? null : this.currentMeasureIndex();
    this.cursor.reset();
    while (!this.atEnd()) {
      const measureIndex = this.currentMeasureIndex();
      const markersHere = byMeasure.get(measureIndex);
      if (markersHere) {
        for (const note of this.cursor.NotesUnderCursor()) {
          if (!note || !note.Pitch) continue;
          const midi = pitchToMidi(note.Pitch);
          if (markersHere.some((m) => m.expected.includes(midi))) {
            this._colorNote(note, PROBLEM_NOTE_COLOR);
          }
        }
      }
      this.cursor.next();
    }

    if (resumeMeasureIndex != null) this.jumpToMeasure(resumeMeasureIndex);
    else this.cursor.reset();
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
