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
3. Write the commit message in the [Conventional Commits](https://www.conventionalcommits.org/) style. `fix:` makes a
   patch release, `feat:` a minor release, and `feat!:` or a `BREAKING CHANGE:` footer a major release. The messages
   decide the next version number. Use `feat!:` for a change to the rules or the scoring that players see.
4. Open a pull request against `main` that says what changed and why.

## Releasing

Merging to `main` is all it takes. After the deploy, the `release` job runs semantic-release. It writes the notes of the
release into `CHANGELOG.md`, commits that file to `main` as `chore(release): X.Y.Z`, creates the `vX.Y.Z` tag, and
creates a GitHub Release with the same notes. The release commit starts no workflow of its own.

The job uses the workflow's own `GITHUB_TOKEN`, which may push the commit and create the release. Do not edit
`CHANGELOG.md` by hand. The commit messages generate it.

`.releaserc.yml` names the plugins in the order that they run. `release/package.json` pins semantic-release and every
plugin to an exact version, and `release/package-lock.json` locks the rest. To bump a version, change it in
`release/package.json`, run `npm install --prefix release --package-lock-only`, and commit both files.

## Licensing

By contributing, you agree that your changes are published under the MIT License in `LICENSE`.
