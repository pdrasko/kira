// Tiny helper to hand-author MusicXML for the built-in practice library
// without typing raw XML by hand for every note. Not a general-purpose
// engraving tool — just enough to describe a monophonic melody.
//
// A "note spec" is either the string 'rest' or a pitch like 'C4', 'F#5',
// 'Bb3' paired with a duration in 16th-note units (1..16, where 16 is a
// whole note in 4/4).

const DURATION_TABLE = {
  1: { type: '16th', dots: 0 },
  2: { type: 'eighth', dots: 0 },
  3: { type: 'eighth', dots: 1 },
  4: { type: 'quarter', dots: 0 },
  6: { type: 'quarter', dots: 1 },
  8: { type: 'half', dots: 0 },
  12: { type: 'half', dots: 1 },
  16: { type: 'whole', dots: 0 },
};

const DIVISIONS = 4; // 1 division = a 16th note

function parsePitch(spec) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(spec);
  if (!m) throw new Error(`Bad pitch spec: ${spec}`);
  const [, step, accidental, octave] = m;
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return { step, alter, octave: Number(octave) };
}

function noteXml(spec, durationUnits) {
  const durationInfo = DURATION_TABLE[durationUnits];
  if (!durationInfo) throw new Error(`Unsupported duration ${durationUnits}`);
  const dotsXml = '<dot/>'.repeat(durationInfo.dots);
  if (spec === 'rest') {
    return `<note><rest/><duration>${durationUnits}</duration><voice>1</voice><type>${durationInfo.type}</type>${dotsXml}</note>`;
  }
  const { step, alter, octave } = parsePitch(spec);
  const alterXml = alter ? `<alter>${alter}</alter>` : '';
  return (
    `<note><pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>` +
    `<duration>${durationUnits}</duration><voice>1</voice><type>${durationInfo.type}</type>${dotsXml}</note>`
  );
}

/**
 * @param {object} meta
 * @param {string} meta.title
 * @param {string} meta.composer
 * @param {number} [meta.fifths] key signature, circle-of-fifths count (0 = C major)
 * @param {number} [meta.beats] time signature numerator
 * @param {number} [meta.beatType] time signature denominator
 * @param {Array<Array<[string, number]>>} measures each measure is a list of [pitchOrRest, durationUnits]
 */
export function buildMusicXml(meta, measures) {
  const { title, composer, fifths = 0, beats = 4, beatType = 4 } = meta;
  const measuresXml = measures
    .map((measureNotes, i) => {
      const attributesXml =
        i === 0
          ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifths}</fifths></key>` +
            `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
            `<clef><sign>G</sign><line>2</line></clef></attributes>`
          : '';
      const notesXml = measureNotes.map(([spec, dur]) => noteXml(spec, dur)).join('');
      return `<measure number="${i + 1}">${attributesXml}${notesXml}</measure>`;
    })
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">` +
    `<score-partwise version="3.1">` +
    `<work><work-title>${escapeXml(title)}</work-title></work>` +
    `<identification><creator type="composer">${escapeXml(composer)}</creator></identification>` +
    `<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>` +
    `<part id="P1">${measuresXml}</part>` +
    `</score-partwise>`
  );
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
