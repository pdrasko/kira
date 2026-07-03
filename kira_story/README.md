# Kira Story

An interactive story built with [Twine](https://twinery.org/) (SugarCube
2 format), written and extended collaboratively with Claude via the
`/story` skill.

- `src/story.tw` — the story source, in Twee3 notation.
- `index.html` — the compiled, playable game. This is what GitHub Pages
  serves, at `/kira/kira_story/`.
- `STORY_MEMORY.md` — recursive hot/medium/cold summary of the story so
  far, used by `/story` to resume a session without re-reading everything.
- `Makefile` — `make build` compiles `src/story.tw` into `index.html`
  using [extwee](https://github.com/videlais/extwee) and the pinned
  SugarCube 2.37.3 story format (downloaded on first build into
  `build/tools/`, gitignored).

## Building locally

```sh
cd kira_story
make build
open index.html   # or: python3 -m http.server, then visit /index.html
```

## Continuing the story

Run `/story` — it reads `STORY_MEMORY.md`, recaps where things left off,
asks what happens next, writes the new passage(s) into `src/story.tw`,
rebuilds, and commits.
