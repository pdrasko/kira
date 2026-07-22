// Minimal canvas piano-roll, used instead of staff notation when practicing
// a freehand MIDI recording (there's no MusicXML to render for those).
// Each recorded chord-step becomes a column; columns behind the playhead
// dim, the current one is amber, upcoming ones are blue.

const COL_WIDTH = 22;
const NOTE_HEIGHT = 4;
const MIN_MIDI = 36; // C2
const MAX_MIDI = 96; // C7

function pitchToY(pitch, height) {
  const clamped = Math.max(MIN_MIDI, Math.min(MAX_MIDI, pitch));
  const ratio = (clamped - MIN_MIDI) / (MAX_MIDI - MIN_MIDI);
  return height - ratio * height;
}

function draw(ctx, canvas, steps, currentIndex) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0d1116';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  steps.forEach((step, i) => {
    const x = i * COL_WIDTH;
    ctx.fillStyle = i < currentIndex ? '#2c3644' : i === currentIndex ? '#f59e0b' : '#3b82f6';
    for (const pitch of step.pitches) {
      const y = pitchToY(pitch, canvas.height);
      ctx.fillRect(x + 2, y - NOTE_HEIGHT / 2, COL_WIDTH - 4, NOTE_HEIGHT);
    }
  });
  if (currentIndex >= 0 && currentIndex < steps.length) {
    ctx.fillStyle = 'rgba(245,158,11,0.15)';
    ctx.fillRect(currentIndex * COL_WIDTH, 0, COL_WIDTH, canvas.height);
  }
}

export function renderPianoRoll(canvas, steps) {
  canvas.width = Math.max(canvas.parentElement.clientWidth, steps.length * COL_WIDTH || COL_WIDTH);
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  draw(ctx, canvas, steps, -1);
  return {
    setCurrentIndex(index) {
      draw(ctx, canvas, steps, index);
      const scroller = canvas.parentElement;
      if (scroller) scroller.scrollLeft = Math.max(0, index * COL_WIDTH - scroller.clientWidth / 2);
    },
  };
}
