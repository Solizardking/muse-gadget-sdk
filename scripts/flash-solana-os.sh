#!/usr/bin/env bash
# Flash Solana OS 0.4.4 onto a Solana BP26 badge (ESP32-C5, CH340) with esptool 5.
# Usage: scripts/flash-solana-os.sh PORT [--erase-settings | --erase-all]
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../firmware/solana-os/0.4.4" && pwd)"
BAUD=460800   # 921600 is unreliable on the CH340C

usage() { echo "usage: $0 PORT [--erase-settings | --erase-all]" >&2; exit 2; }
[ $# -ge 1 ] || usage
PORT="$1"; shift
ERASE=none
for arg in "$@"; do
  case "$arg" in
    --erase-settings) ERASE=settings ;;
    --erase-all) ERASE=all ;;
    *) usage ;;
  esac
done

if command -v esptool >/dev/null 2>&1; then ESPTOOL=esptool
else echo "esptool 5 not found: pipx install esptool (or brew install esptool)" >&2; exit 1; fi
MAJOR="$($ESPTOOL version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1 | cut -d. -f1 || true)"
if [ "${MAJOR:-0}" -lt 5 ]; then
  echo "esptool 5 or newer is required (found: ${MAJOR:-unknown})" >&2; exit 1
fi

echo "Verifying checksums in $DIR"
( cd "$DIR"
  if command -v sha256sum >/dev/null 2>&1; then sha256sum -c SHA256SUMS
  else shasum -a 256 -c SHA256SUMS; fi )

ET=("$ESPTOOL" --chip esp32c5 -p "$PORT" -b "$BAUD" --no-stub)

if [ "$ERASE" != none ]; then
  echo "Erasing settings (0x9000 0x6000)"
  "${ET[@]}" erase-region 0x9000 0x6000
fi
if [ "$ERASE" = all ]; then
  echo "Erasing internal storage (0x11000 0x1000, 0x820000 0x7e0000)"
  "${ET[@]}" erase-region 0x11000 0x1000
  "${ET[@]}" erase-region 0x820000 0x7e0000
fi

cd "$DIR"
"${ET[@]}" write-flash --flash-mode dio --flash-freq 80m --flash-size 16MB \
  0x2000 bootloader.bin \
  0x8000 partition-table.bin \
  0xf000 ota_data_initial.bin \
  0x20000 solana_os.bin
echo "Done. The badge restarts into Solana OS 0.4.4."
