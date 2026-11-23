#!/usr/bin/env python3
"""Write COMPLETE OrcaSlicer presets (inherits/include flattened) for headless slicing.

OrcaSlicer >= 2.5 keeps system presets only in binary .opc caches, so the CLI cannot
`--load-settings` them by name. This fetches the BBL source JSONs from the OrcaSlicer repo at
the tag matching the installed app, flattens `inherits` / `include`, and writes
<out>/{machine,process,filament}.json.

usage: resolve_presets.py <orca-tag> <out-dir> machine:"<name>" process:"<name>" filament:"<name>"
e.g.   resolve_presets.py v2.5.1 ./a1mini-pla-0.20 \
         "machine:Bambu Lab A1 mini 0.4 nozzle" \
         "process:0.20mm Standard @BBL A1M" "filament:Generic PLA @BBL A1M"
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPOS = ("OrcaSlicer/OrcaSlicer", "SoftFever/OrcaSlicer")
KINDS = ("machine", "process", "filament")


def fetch(tag: str, kind: str, name: str) -> dict:
    last: Exception | None = None
    for repo in REPOS:
        url = (
            f"https://raw.githubusercontent.com/{repo}/{tag}/resources/profiles/BBL/{kind}/"
            f"{urllib.parse.quote(name)}.json"
        )
        try:
            with urllib.request.urlopen(url, timeout=30) as res:
                return json.load(res)
        except Exception as err:  # noqa: BLE001 - try the next mirror, report the last error
            last = err
    raise SystemExit(f"cannot fetch {kind} preset {name!r} at {tag}: {last}")


def flatten(tag: str, kind: str, name: str, seen: tuple[str, ...] = ()) -> dict:
    if name in seen:
        raise SystemExit(f"preset cycle: {' -> '.join(seen + (name,))}")
    data = fetch(tag, kind, name)
    merged: dict = {}
    parents = [p for p in [data.get("inherits")] if p] + list(data.get("include") or [])
    for parent in parents:
        merged.update(flatten(tag, kind, parent, seen + (name,)))
    merged.update({k: v for k, v in data.items() if k not in ("inherits", "include")})
    merged["name"] = name
    return merged


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print(__doc__)
        return 2
    tag, out = argv[1], Path(argv[2])
    out.mkdir(parents=True, exist_ok=True)
    wanted = dict(a.split(":", 1) for a in argv[3:])
    missing = [k for k in KINDS if k not in wanted]
    if missing:
        raise SystemExit(f"missing preset kinds: {', '.join(missing)}")
    for kind in KINDS:
        preset = flatten(tag, kind, wanted[kind])
        (out / f"{kind}.json").write_text(json.dumps(preset, indent=2, ensure_ascii=False) + "\n")
        print(f"{kind}: {wanted[kind]} -> {out / (kind + '.json')} ({len(preset)} keys)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
