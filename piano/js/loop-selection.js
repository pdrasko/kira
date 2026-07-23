// Pure state-machine logic for building a loop region by double-clicking
// measures on the sheet music — kept separate from the DOM/OSMD wiring in
// player.js so the rules can be reasoned about (and tested) on their own.
//
// Invariant: there is only ever one loop region, always a contiguous
// [startMeasure, endMeasure] range (1-based, inclusive) or null (no loop).
// Adding or removing a measure is only ever allowed at the head or the
// tail — there is no operation that produces two disconnected groups.

/**
 * @param {{startMeasure:number, endMeasure:number}|null} currentRegion
 * @param {number} measureCount total measures in the piece
 * @param {number} clickedMeasure 1-based measure number that was double-clicked
 * @returns {{startMeasure:number, endMeasure:number}|null} the new loop region
 */
export function toggleMeasureInLoop(currentRegion, measureCount, clickedMeasure) {
  const m = Math.max(1, Math.min(measureCount, Math.round(clickedMeasure)));

  if (!currentRegion) {
    return { startMeasure: m, endMeasure: m };
  }

  const { startMeasure: start, endMeasure: end } = currentRegion;

  // Clicking the only measure in a single-measure loop removes it entirely.
  if (m === start && m === end) return null;

  // Clicking the head or tail of a longer loop shrinks it by one measure.
  if (m === start) return { startMeasure: start + 1, endMeasure: end };
  if (m === end) return { startMeasure: start, endMeasure: end - 1 };

  // Clicking strictly inside the loop would split it into two pieces —
  // not allowed, so the whole loop clears instead.
  if (m > start && m < end) return null;

  // Adjacent just outside either end extends the loop by one measure.
  if (m === start - 1) return { startMeasure: m, endMeasure: end };
  if (m === end + 1) return { startMeasure: start, endMeasure: m };

  // Anywhere else is disconnected from the current loop. Only one loop
  // group is ever allowed, so this starts a fresh one at the clicked
  // measure rather than creating a second, disassociated group.
  return { startMeasure: m, endMeasure: m };
}

export function wholeSongLoop(measureCount) {
  return measureCount > 0 ? { startMeasure: 1, endMeasure: measureCount } : null;
}
