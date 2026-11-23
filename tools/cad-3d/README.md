# cad-3d — toolchain for the `cad-3d-printing` skill

Code-CAD (build123d + the `cad` CLI), mesh checks (trimesh, admesh) and headless slicing
(OrcaSlicer) for the `Model 3D` workflow. Installed **per machine, outside any project**, in
`$ZIBBY_CAD_HOME` (default `~/.zibby/tools/cad-3d`):

```
venv/                          Python 3.12 + pinned packages (requirements.txt)
orca-presets/a1mini-pla-0.20/  complete machine/process/filament presets
resolve_presets.py             flattens OrcaSlicer BBL presets at the installed app's tag
```

```bash
tools/cad-3d/setup.sh          # venv + presets; reports what is missing
tools/cad-3d/setup.sh --apps   # also brew-installs admesh and the OrcaSlicer cask
```

Idempotent. Telemetry and auto-update of `cad` are switched off. Other printers: run
`resolve_presets.py` again with their preset names (see its docstring).
