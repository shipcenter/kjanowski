#!/usr/bin/env bash
# Składa panel w jeden plik dist/index.html (strona publikowana jako Artifact).
set -euo pipefail
cd "$(dirname "$0")"
OUT=dist/index.html
mkdir -p dist
BOX=$(grep -o "box: '[^']*'" src/core.js | sed "s/^box: '//; s/'$//")
{
  echo '<title>Panel franczyzy Ship Center</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,500..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
  echo '<style>'
  cat src/styles.css
  echo '</style>'
  sed "s|__BOX__|${BOX}|" src/shell.html
  echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>'
  echo '<script>'
  for f in core ui dashboard leads plan messages location data main; do cat "src/$f.js"; echo; done
  echo '</script>'
} > "$OUT"
echo "Zbudowano $OUT ($(wc -c < "$OUT") B)"
