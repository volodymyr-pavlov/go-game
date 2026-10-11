# Contributing

This is a personal project, but fixes are welcome: a bug in the rules, a wrong score, a bad engine move with a
position that shows it, or a build problem. For anything bigger than a fix, open an issue first, so we can agree on
it before you spend time on it.

The repository is a Turborepo of `apps/` (web, api, tma, youtube) and `packages/` (engine, presentation, bridge, types, core, client, tsconfig). Inside `apps/web/src`, imports name a module from the root, like
`@/ui/dom.ts`. Code in another package is imported by the name of its package, like `@go-game/core/board.ts`. Neither uses
`../` steps across folders. Doc comments
(`/** ... */`) in the TypeScript sources follow [TSDoc](https://tsdoc.org). `npm run lint` checks them.

Tags, statuses and kinds are bit flags, never strings and never enums: a game mode, a room status, a result kind, the
reason a move is illegal, the type of a message. A flag is a plain power of two in a `const` object, like `RoomStatus`
in `packages/core/src/protocol.ts`, and `has` in `packages/core/src/flags.ts` tests it. They travel as numbers in JSON and in D1. Text is
for people (messages, nicknames) and for identifiers (uids, element ids).

## Making a change

1. Fork the project on GitHub and create a branch.
2. Run `npm run dev` to try the change. Check that `npm run check`, `npm test` and `npm run test:e2e`
   pass, and that `gofmt -l engine` prints nothing. A change to accounts, the leaderboard or online play also needs
   `npm run test:e2e:firebase`, which starts the Firebase Auth emulator and the game server itself.
3. Add a line under `Unreleased` in `CHANGELOG.md` if players can see the change, or if it changes the engine.
4. Open a pull request against `main` that says what changed and why.

## Releasing

Versions follow [Semantic Versioning](https://semver.org/): MAJOR for changes to the rules or the scoring that
players see, MINOR for new features and changes in engine strength, PATCH for fixes.

1. Rename `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD` and add an empty `## [Unreleased]`
   above it. Set the same version in `package.json`.
2. Commit with the message `Release vX.Y.Z`, then `git tag -a vX.Y.Z -m "vX.Y.Z"` and `git push origin main vX.Y.Z`.
3. The `release` job of the workflow checks that the section exists and creates the GitHub Release from it. The tag does not
   deploy the site: only the default branch goes to Cloudflare, see "Production setup" in `README.md`.

## Licensing

By contributing, you agree that your changes are published under the MIT License in `LICENSE`.
