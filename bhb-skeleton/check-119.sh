#!/usr/bin/env bash
# Backhome Buddy — which build 119 files are actually in my repo?
#
# Run from anywhere inside your repo:   bash check-119.sh
# It hashes every file build 119 ships and compares it with your copy, so one
# run tells you everything that is missing or stale. No guessing, no waiting
# on a Vercel build to find them one at a time.

MAN="$(dirname "$0")/BUILD-119-MANIFEST.txt"
[ -f "$MAN" ] || { echo "BUILD-119-MANIFEST.txt must sit next to this script."; exit 1; }

ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$ROOT" ]; then
  echo "Not inside a git repository. cd into your repo and run it there."
  exit 1
fi
cd "$ROOT" || exit 1

# The app may sit at the repo root or inside bhb-skeleton/.
APP="."
[ -d "bhb-skeleton/src" ] && APP="bhb-skeleton"
echo "Repo:   $ROOT"
echo "App:    $APP"
echo "Branch: $(git branch --show-current)"
echo

OK=0; OLD=0; MISSING=0
OLDLIST=""; MISSLIST=""

while read -r hash path; do
  [ -z "$path" ] && continue
  target="$APP/$path"
  if [ ! -f "$target" ]; then
    MISSING=$((MISSING+1)); MISSLIST="$MISSLIST  $path\n"
  elif [ "$(sha256sum "$target" | cut -c1-16)" = "$hash" ]; then
    OK=$((OK+1))
  else
    OLD=$((OLD+1)); OLDLIST="$OLDLIST  $path\n"
  fi
done < "$MAN"

echo "=================================================="
printf "  up to date : %s\n  STALE      : %s\n  MISSING    : %s\n" "$OK" "$OLD" "$MISSING"
echo "=================================================="

if [ "$OLD" -gt 0 ]; then
  echo
  echo "STALE — your copy differs from build 119. Replace these:"
  printf "$OLDLIST"
fi
if [ "$MISSING" -gt 0 ]; then
  echo
  echo "MISSING — not in your repo at all. Add these:"
  printf "$MISSLIST"
fi
if [ "$OLD" -eq 0 ] && [ "$MISSING" -eq 0 ]; then
  echo
  echo "Everything from build 119 is present and current."
  echo "Run 'npm run typecheck' before pushing."
fi
echo
