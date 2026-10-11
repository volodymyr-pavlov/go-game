# Changelog

The changes to the game and its engine that matter. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). A `vX.Y.Z` tag on the default branch publishes the matching section below as a
GitHub Release.

## [Unreleased]

The leaderboard. The code is in the repository, but a build without the `VITE_FIREBASE_*` values has none of it, and
1.0.0 was built that way.

### Added

- Player accounts, a leaderboard by Elo rating with a profile page and match history, and online play in rooms. A player
  is a nickname, signed in with Firebase Auth (anonymous, with an optional email and password to keep it on another
  device). A player can delete their own entry.
- A game server on Cloudflare: a Worker, D1 for the players and their games, and one Durable Object for each online
  game. The server works out the ratings itself, and checks every move of an online game with the game rules.
- Protection against scripts: a Cloudflare Turnstile check before a nickname, a new room or a join, at most 20 such
  writes a minute for each player, one open room for each player, at most 200 open rooms, and a player who floods a room
  with messages is disconnected.
- An online game is lost on time when the player to move does not move for five minutes.
- Skeletons of a Telegram Mini App and a YouTube Playable, with the same game against the engine on the shared board. The game
  server accepts a Telegram sign-in (`Authorization: tma <initData>`, checked with the bot token). Telegram Stars are not on sale.

### Changed

- The engine downloads as 0.96 MB instead of 1.2 MB: the build compresses it once with Brotli at the highest level, and a
  Worker in front of the site serves that file to browsers that accept Brotli.

## [1.0.0] - 2026-09-24

First release.

### Added

- 9x9 Go with area scoring and komi against Gopher, Bear or Elephant, three levels of a Monte Carlo Tree Search
  engine written in Go and run as WebAssembly in a Web Worker, at 200, 500 and 1000 playouts. You play Black or
  White, or a friend at the same keyboard. Pass, resign, new game, and confetti when you win.
- The board drawn with PixiJS on the Classic Wood skin: a warm wooden board, slate and shell stones, a stone sound
  and a pale wood grain behind the page. Skins live under `apps/web/public/skins/` and `apps/web/src/presentation/skins/`.
- A loading screen with a small animated board while the scripts and the engine get ready.
- A notice that stays when the engine cannot load, with the next engine turn trying again on a fresh worker, and a
  plain message for browsers without WebAssembly or Web Workers.
- Google Analytics behind a consent bar. Off unless the build has `VITE_GA4_ID`. An "Analytics choice" link takes
  the consent back.
- Privacy and terms pages, and a "Licenses" page (`third-party-licenses.txt`) with the licenses of the fonts and
  libraries that ship with the build.
- Self-hosted fonts, a Content Security Policy, a page that refuses to run inside a frame of another origin,
  Open Graph tags, `robots.txt` and `sitemap.xml`, and labels on the close buttons of the dialogs for screen readers.
- Go tests and a benchmark for the engine, Vitest for the app, and Playwright for the game on the real board.
- A pipeline that checks, tests and builds every branch, deploys the default branch to Cloudflare as a static
  site, and creates a release from this file for every `vX.Y.Z` tag. Images are pinned by digest. The repository is a
  Turborepo of `apps/web`, `apps/api`, `apps/tma`, `apps/youtube` and the packages `engine`, `presentation`, `bridge`, `types`, `core`, `client` and `tsconfig`.
- LICENSE (MIT), CHANGELOG and CONTRIBUTING.
