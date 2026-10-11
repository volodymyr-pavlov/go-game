#!/bin/sh
# The Firebase Auth emulator. Firebase does only sign-in now, and this emulator needs no Java and no Docker.
# With no arguments it runs until Ctrl-C. With arguments it runs them while the emulator is up, for example `sh scripts/firebase-auth-emulator.sh "npx playwright test"`.
set -eu
cd "$(dirname "$0")/.."
PROJECT=demo-go-game
FIREBASE_TOOLS_VERSION=15.30.2
FIREBASE="npx --yes firebase-tools@$FIREBASE_TOOLS_VERSION"

# The path is absolute because npx runs its command from the folder of the package, not from the folder it was started in.
CONFIG="$PWD/firebase/firebase.json"
if [ $# -eq 0 ]; then
  exec $FIREBASE --config "$CONFIG" emulators:start --only auth --project $PROJECT
fi
exec $FIREBASE --config "$CONFIG" emulators:exec --only auth --project $PROJECT "$*"
