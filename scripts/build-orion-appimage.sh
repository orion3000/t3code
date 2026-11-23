#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPIMAGE_DIR="${T3CODE_APPIMAGE_DIR:-$HOME/.local/opt/t3-code}"
STAGED_APPIMAGE="$APPIMAGE_DIR/T3-Code-Orion.AppImage"
LIVE_APPIMAGE="$APPIMAGE_DIR/T3-Code.AppImage"

DO_REBASE=0
DO_INSTALL=0
SKIP_TESTS=0

for arg in "$@"; do
  case "$arg" in
    --rebase) DO_REBASE=1 ;;
    --install) DO_INSTALL=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/build-orion-appimage.sh [--rebase] [--install] [--skip-tests]

Builds Orion's client-enhanced Linux x64 T3 Code AppImage with T3 Connect enabled.
  --rebase      Fetch upstream/main and rebase current branch before building
  --install     Replace ~/.local/opt/t3-code/T3-Code.AppImage (backs up old copy;
                close T3 Code first so the live AppImage is not in use)
  --skip-tests  Skip unit tests and typecheck before building
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

if [ "$DO_REBASE" -eq 1 ]; then
  echo "==> Fetching upstream/main and rebasing..."
  git fetch upstream main
  git rebase upstream/main
  pnpm install --frozen-lockfile
fi

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "==> Copying .env.example -> .env (enables T3 Connect)"
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
  echo "==> Running targeted unit tests and @t3tools/web typecheck..."
  pnpm --filter @t3tools/web exec vp test run --project unit \
    src/teamEnvironmentPreferences.test.ts \
    src/uiStateStore.test.ts \
    src/environmentGrouping.test.ts \
    src/components/Sidebar.logic.test.ts
  pnpm exec vp run --filter @t3tools/web typecheck
fi

echo "==> Building Linux x64 AppImage..."
pnpm run dist:desktop:linux

BUILT_APPIMAGE="$(find "$REPO_ROOT/release" -maxdepth 2 -name '*.AppImage' -type f -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [ -z "$BUILT_APPIMAGE" ] || [ ! -f "$BUILT_APPIMAGE" ]; then
  echo "ERROR: Could not locate built AppImage under $REPO_ROOT/release" >&2
  exit 1
fi

mkdir -p "$APPIMAGE_DIR"
cp "$BUILT_APPIMAGE" "$STAGED_APPIMAGE.tmp"
chmod +x "$STAGED_APPIMAGE.tmp"
mv -f "$STAGED_APPIMAGE.tmp" "$STAGED_APPIMAGE"
echo "==> Staged custom AppImage at: $STAGED_APPIMAGE"

if [ "$DO_INSTALL" -eq 1 ]; then
  if [ -f "$LIVE_APPIMAGE" ]; then
    BACKUP="$APPIMAGE_DIR/T3-Code.AppImage.backup.$(date +%Y%m%d-%H%M%S)"
    cp "$LIVE_APPIMAGE" "$BACKUP"
    echo "==> Backed up previous AppImage to: $BACKUP"
  fi
  cp "$STAGED_APPIMAGE" "$LIVE_APPIMAGE.tmp"
  chmod +x "$LIVE_APPIMAGE.tmp"
  mv -f "$LIVE_APPIMAGE.tmp" "$LIVE_APPIMAGE"
  echo "==> Installed to: $LIVE_APPIMAGE"
  echo "    Restart T3 Code to run the new build."
else
  echo ""
  echo "To switch to this build once you close T3 Code:"
  echo "  cp \"$LIVE_APPIMAGE\" \"$LIVE_APPIMAGE.backup\" && mv -f \"$STAGED_APPIMAGE\" \"$LIVE_APPIMAGE\""
  echo "Or re-run with --install after closing T3 Code."
fi
