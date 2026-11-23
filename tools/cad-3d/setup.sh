#!/usr/bin/env bash
# Install the code-CAD / 3D-print toolchain used by the `cad-3d-printing` skill.
# Idempotent. Lives OUTSIDE any project: $ZIBBY_CAD_HOME (default ~/.zibby/tools/cad-3d).
#   ./setup.sh           venv + presets (+ checks for admesh / OrcaSlicer)
#   ./setup.sh --apps    also `brew install admesh` and `brew install --cask orcaslicer`
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${ZIBBY_CAD_HOME:-$HOME/.zibby/tools/cad-3d}"
ORCA="/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer"
PY="${PYTHON:-python3.12}"

if [[ "${1:-}" == "--apps" ]]; then
  command -v admesh >/dev/null || brew install admesh
  [[ -x "$ORCA" ]] || brew install --cask orcaslicer
fi

mkdir -p "$HOME_DIR"
if [[ ! -x "$HOME_DIR/venv/bin/python" ]]; then
  "$PY" -m venv "$HOME_DIR/venv"
fi
"$HOME_DIR/venv/bin/pip" install --quiet --upgrade pip
"$HOME_DIR/venv/bin/pip" install --quiet -r "$HERE/requirements.txt"

# Telemetry / auto-update off, as a saved choice and in the environment (skill exports too).
export DO_NOT_TRACK=1 CAD_TELEMETRY=0 CAD_UPDATE_CHECK=0
"$HOME_DIR/venv/bin/cad" telemetry off >/dev/null 2>&1 || true
"$HOME_DIR/venv/bin/cad" update auto off >/dev/null 2>&1 || true

# Complete presets for the Bambu A1 mini, resolved at the tag matching the installed app.
if [[ -x "$ORCA" ]]; then
  VER="$(/usr/bin/defaults read /Applications/OrcaSlicer.app/Contents/Info CFBundleShortVersionString 2>/dev/null || true)"
  TAG="v${VER%%-*}"
  if [[ -n "$VER" && ! -f "$HOME_DIR/orca-presets/a1mini-pla-0.20/process.json" ]]; then
    "$HOME_DIR/venv/bin/python" "$HERE/resolve_presets.py" "$TAG" "$HOME_DIR/orca-presets/a1mini-pla-0.20" \
      "machine:Bambu Lab A1 mini 0.4 nozzle" "process:0.20mm Standard @BBL A1M" "filament:Generic PLA @BBL A1M"
  fi
fi
cp "$HERE/resolve_presets.py" "$HOME_DIR/resolve_presets.py"

echo "--- cad-3d toolchain: $HOME_DIR"
"$HOME_DIR/venv/bin/python" -c "import build123d, trimesh; print('build123d', build123d.__version__, '| trimesh', trimesh.__version__)"
command -v admesh >/dev/null && echo "admesh: $(command -v admesh)" || echo "MISSING admesh  -> ./setup.sh --apps"
[[ -x "$ORCA" ]] && echo "OrcaSlicer: $ORCA" || echo "MISSING OrcaSlicer -> ./setup.sh --apps"
[[ -f "$HOME_DIR/orca-presets/a1mini-pla-0.20/process.json" ]] && echo "presets: ok" || echo "presets: not resolved yet (needs OrcaSlicer)"
