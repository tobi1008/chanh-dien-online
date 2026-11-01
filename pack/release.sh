#!/usr/bin/env bash
# Builds the Windows zip and publishes it as a GitHub Release. Every Chánh Điện already installed on Windows sees it
# under "Cập nhật" in the control panel and installs it with one click: no more sending zips around.
#
#   bash pack/release.sh                       (notes = commits since the previous release)
#   bash pack/release.sh "Sửa bảng công đức"   (your own notes)
#
# Runs by itself on GitHub Actions for every push to main that touches the live kit (.github/workflows/release.yml).
# By hand: needs gh logged in with push access to the repo. Override the repo with UPDATE_REPO=owner/name (must match server.mjs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${UPDATE_REPO:-tobi1008/chanh-dien-online}"
export VERSION="$(date +%Y.%m.%d.%H%M)"
ZIP="$ROOT/dist/ChanhDienLive-windows-x64.zip"

bash "$ROOT/pack/build-windows.sh"

prev="$(gh release view -R "$REPO" --json tagName -q .tagName 2>/dev/null || true)"
if [ $# -gt 0 ]; then notes="$*"
elif [ -n "$prev" ] && git -C "$ROOT" rev-parse -q --verify "$prev" >/dev/null; then notes="$(git -C "$ROOT" log --format='- %s' "$prev"..HEAD)"
else notes="$(git -C "$ROOT" log -5 --format='- %s')"; fi

gh release create "v$VERSION" "$ZIP" -R "$REPO" --title "Chánh Điện $VERSION" --notes "${notes:-Cập nhật}" --target "$(git -C "$ROOT" rev-parse HEAD)"
echo "✓ Đã phát hành v$VERSION trên $REPO: máy Windows bấm \"Kiểm tra cập nhật\" là thấy."
