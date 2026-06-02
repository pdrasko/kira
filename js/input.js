export const KeyState = {
  w: false, a: false, s: false, d: false,
  space: false, enter: false, i: false,
  b: false, escape: false
};

export let enterJustPressed = false;
export let iJustPressed = false;
export let bJustPressed = false;

let _enterJust = false;
let _iJust = false;
let _bJust = false;

export function initInput() {
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') KeyState.w = true;
    if (k === 'a') KeyState.a = true;
    if (k === 's') KeyState.s = true;
    if (k === 'd') KeyState.d = true;
    if (k === ' ') { KeyState.space = true; e.preventDefault(); }
    if (k === 'enter') { KeyState.enter = true; _enterJust = true; e.preventDefault(); }
    if (k === 'i') { KeyState.i = true; _iJust = true; }
    if (k === 'b') { KeyState.b = true; _bJust = true; }
    if (k === 'escape') KeyState.escape = true;
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') KeyState.w = false;
    if (k === 'a') KeyState.a = false;
    if (k === 's') KeyState.s = false;
    if (k === 'd') KeyState.d = false;
    if (k === ' ') KeyState.space = false;
    if (k === 'enter') KeyState.enter = false;
    if (k === 'i') KeyState.i = false;
    if (k === 'b') KeyState.b = false;
    if (k === 'escape') KeyState.escape = false;
  });
}

export function syncFrameFlags() {
  enterJustPressed = _enterJust;
  iJustPressed = _iJust;
  bJustPressed = _bJust;
  _enterJust = false;
  _iJust = false;
  _bJust = false;
}
