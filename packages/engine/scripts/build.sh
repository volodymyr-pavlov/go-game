#!/bin/sh
# Compiles the engine to WebAssembly once, and puts it, with Go's JavaScript glue, in the public folder of every app
# that plays the game: the web app, the Telegram Mini App and the YouTube Playable.
set -eu
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$OUT/engine.wasm" .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$OUT/wasm_exec.js" # Starting with Go 1.24 it is in lib/wasm
for app in web tma youtube; do
  mkdir -p "../../apps/$app/public"
  cp "$OUT/engine.wasm" "$OUT/wasm_exec.js" "../../apps/$app/public/"
done
