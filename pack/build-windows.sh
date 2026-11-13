#!/usr/bin/env bash
# Builds a portable Windows package: dist/ChanhDienLive-windows-x64.zip
# Nothing to install on the streaming PC: the zip carries node.exe, the server and a .bat to start it.
# The server and all its dependencies are bundled into ONE file with esbuild: a node_modules folder is ~3,600 tiny
# files, which Windows' "Extract All" + Defender take minutes to unpack. Bundled, the zip holds ~35 files.
#
#   bash pack/build-windows.sh            (run from anywhere; needs curl, unzip, zip, npm/npx)
#   NODE_VERSION=v24.22.2 bash pack/build-windows.sh
#   VERSION=2026.11.01.2000 bash pack/build-windows.sh   (default: current date + time)
#
# All dependencies are plain JavaScript (no native addons), so installing them on macOS/Linux is fine for Windows.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v24.22.2}"          # Node 24 LTS: still supports Windows 10
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/pack/.cache"
OUT="$ROOT/dist"
APP="$OUT/ChanhDienLive"
ZIP="$OUT/ChanhDienLive-windows-x64.zip"
NODE_ZIP="node-$NODE_VERSION-win-x64.zip"

mkdir -p "$CACHE"
rm -rf "$APP" "$ZIP"; mkdir -p "$APP/node" "$APP/live"

# 1. node.exe, checked against the official SHA-256 list
if [ ! -f "$CACHE/$NODE_ZIP" ]; then
  echo "→ Tải Node.js $NODE_VERSION cho Windows"
  curl -fL --progress-bar -o "$CACHE/$NODE_ZIP.part" "https://nodejs.org/dist/$NODE_VERSION/$NODE_ZIP"
  mv "$CACHE/$NODE_ZIP.part" "$CACHE/$NODE_ZIP"
fi
curl -fsSL -o "$CACHE/SHASUMS256-$NODE_VERSION.txt" "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
want="$(grep " $NODE_ZIP\$" "$CACHE/SHASUMS256-$NODE_VERSION.txt" | cut -d' ' -f1)"
have="$(shasum -a 256 "$CACHE/$NODE_ZIP" | cut -d' ' -f1)"
[ -n "$want" ] && [ "$want" = "$have" ] || { echo "✗ SHA-256 của $NODE_ZIP không khớp, dừng lại"; rm -f "$CACHE/$NODE_ZIP"; exit 1; }
echo "→ SHA-256 node.exe khớp với nodejs.org"
unzip -q -j -o "$CACHE/$NODE_ZIP" "node-$NODE_VERSION-win-x64/node.exe" "node-$NODE_VERSION-win-x64/LICENSE" -d "$APP/node"

# 2. app files (the server serves /assets and /live from the folder above live/)
cp -R "$ROOT/assets" "$APP/assets"
rm -rf "$APP/assets/bg" "$APP/assets/chars" "$APP/assets/"*.zip   # uploads on this machine and source zips stay here
cp "$ROOT/live/"{control.html,overlay.html,scenes.js,people.js} "$APP/live/"
# version the server compares against GitHub Releases for "Cập nhật" (release.sh passes the tag it is about to publish)
VERSION="${VERSION:-$(date +%Y.%m.%d.%H%M)}"
printf '%s' "$VERSION" > "$APP/live/version.txt"
( cd "$ROOT/live" && npm ci --omit=dev --no-audit --no-fund --ignore-scripts --loglevel=error )
echo "→ Gộp server + thư viện thành 1 file"
( cd "$ROOT/live" && npx -y esbuild@0.25.10 server.mjs --bundle --platform=node --format=esm --target=node20 \
    --minify-syntax --legal-comments=none --log-level=error \
    --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" \
    --outfile="$APP/live/server.mjs" )
cp "$ROOT/LICENSE" "$APP/LICENSE.txt"
# licenses of the bundled libraries (their own LICENSE files are not in the zip any more)
{ echo "Thư viện được gộp trong live/server.mjs và giấy phép của chúng"; echo
  for f in "$ROOT"/live/node_modules/{*,@*/*}/LICENSE*; do [ -f "$f" ] || continue
    d="${f%/*}"; echo "==== ${d#"$ROOT"/live/node_modules/} ===="; cat "$f"; echo; done; } > "$APP/THIRD-PARTY-LICENSES.txt"

# 3. launcher + guide with Windows line endings (guide gets a UTF-8 BOM so every Notepad shows the accents)
sed 's/$/\r/' "$ROOT/pack/Mo-Chanh-Dien.bat" > "$APP/Mo-Chanh-Dien.bat"
{ printf '\xEF\xBB\xBF'; sed 's/$/\r/' "$ROOT/pack/HUONG-DAN.txt"; } > "$APP/HUONG-DAN.txt"

# 4. zip
( cd "$OUT" && zip -qr -X "$(basename "$ZIP")" "$(basename "$APP")" )
echo "✓ Xong: $ZIP ($(du -h "$ZIP" | cut -f1)) · phiên bản $VERSION"
