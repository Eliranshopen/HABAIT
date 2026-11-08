# Toolchain report (task 07) — 2026-11-03 12:22

Root: `C:\RnD\Projects\Habait`

## 1a venv create — exit 0
```

```

## 1b pip install -r pip-freeze.txt — exit 0
```

```

## 4 python imports — exit 0
```
C:\RnD\Projects\Habait\tools\habait-venv\Lib\site-packages\fitz\__init__.py:17: FutureWarning: The `fitz` API is deprecated and will be removed in future. Use `import pymupdf` instead.
  warnings.warn(
imports ok 2.5.4 5.0.0
```

## 2 blender hello-render probe — exit 0
```
[hello-render] checks       : {'png_is_requested_size': True, 'png_is_2to1_equirect': True, 'depth_is_metres_at_nadir': True}
[hello-render] OK

Blender quit
```

## 3a npm ci tour360/engine — exit 0
```

added 17 packages in 8s
```

## 3b engine tests — exit 1
```
ok   field of view: the defaults are a 28 mm lens, not Pannellum's 100°
ok   field of view: a desktop window keeps the horizontal bounds, a phone held upright is capped at 80° vertical

13 passed, 2 failed
```

## 3c npm ci tools/appdeps — exit 0
```

added 6 packages in 2s
```

## 5 env lines for the new root
```
export BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"
export PYTHONIOENCODING=utf-8
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
```

## Verdict
All steps exit 0 except the engine tests: **13 passed, 2 failed** (`arrival: arriveYaw…` and `arrival: door behind you…`). The same two fail in the SOURCE `C:\Habait` (run read-only 13:05, 13 passed / 2 failed) → pre-existing in the project, not caused by the copy. Task 07 DONE.
