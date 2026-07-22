# MIDI Virtual Keyboard (proof of concept)

A single static page that connects a MIDI-to-USB synthesizer to a browser via the
[Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) and mirrors
what you play on an on-screen keyboard, so you can confirm connectivity end-to-end before
building anything more elaborate on top of it.

Open it at **https://pdrasko.github.io/kira/midi_keyboard/**.

## What it does

- Asks the browser for MIDI permission (`navigator.requestMIDIAccess`) and lists whatever
  MIDI input devices it finds (e.g. a USB-MIDI adapter plugged into a synth).
- Renders a virtual piano keyboard using the [Qwerty Hancock](https://github.com/stuartmemo/qwerty-hancock)
  library, loaded from a CDN — no build step, no dependencies to install.
- Every `note on` MIDI message lights up the matching key and adds it to a "Currently held"
  readout; the key stays lit for as long as the note is held and turns off again on the
  matching `note off`.
- Keeps a small scrolling event log so you can see raw note on/off traffic while debugging
  the connection.

## Testing with a synth + USB-MIDI adapter + phone

1. Connect the synthesizer to the phone with a MIDI-to-USB adapter (Android phones need an
   OTG/USB-C adapter that supports USB host mode; this is standard on most modern Android
   devices).
2. Open the page above in **Chrome on Android** (or desktop Chrome/Edge while developing).
   Web MIDI is **not available in any browser on iOS/iPadOS** — Chrome for iOS uses Apple's
   WebKit engine, which doesn't expose the Web MIDI API, so this will not work on an iPhone.
3. Tap **Connect MIDI** and accept the permission prompt.
4. Press and hold middle C on the synth — the on-screen "Currently held" readout and the
   corresponding key should light up immediately and stay lit until you release the note.

## Notes / limitations (intentional, for a POC)

- No audio synthesis — this only proves out MIDI connectivity and visual feedback, per the
  original request. Hearing sound still comes from the synth itself.
- No build tooling: everything lives in `index.html`, loading Qwerty Hancock from
  `cdn.jsdelivr.net`. If you outgrow this, swap in a bundler and `npm install qwerty-hancock`.
- The keyboard spans 5 octaves (`C2`–`C6`) in a horizontally scrollable container so it fits
  on a phone screen; it auto-scrolls to center on middle C on load.
