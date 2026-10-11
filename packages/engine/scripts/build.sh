#!/bin/sh
# Compiles the engine to WebAssembly once, and puts it, with Go's JavaScript glue, in the public folder of every app
# that plays the game: the web app, the Telegram Mini App and the YouTube Playable. The web app also gets the binary
# compressed with Brotli at the highest level, which its Worker serves to browsers that accept it: a host that
# compresses on the way out picks a fast, low level, and the file is a quarter bigger.
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
node -e '
  const zlib = require("node:zlib");
  const fs = require("node:fs");
  const [input, output] = process.argv.slice(1);
  const wasm = fs.readFileSync(input);
  const params = { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: wasm.length };
  fs.writeFileSync(output, zlib.brotliCompressSync(wasm, { params }));
' "$OUT/engine.wasm" "../../apps/web/public/engine.wasm.br"
