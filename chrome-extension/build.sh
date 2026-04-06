#!/bin/bash
# Build Dolphin WhatsApp Monitor extension as distributable ZIP
# Usage: bash chrome-extension/build.sh

cd "$(dirname "$0")"

OUT="dolphin-whatsapp-monitor.zip"
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  popup/ \
  background/ \
  content/ \
  icons/icon48.png \
  icons/icon128.png

echo "Built: chrome-extension/$OUT"
echo "Size: $(du -h "$OUT" | cut -f1)"
