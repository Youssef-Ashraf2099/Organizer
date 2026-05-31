# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for bundling the Omni AI Engine into a standalone executable.
Run from AI-engine/ with: pyinstaller ai_engine.spec

The output will be:
  AI-engine/dist/ai-engine.exe  (Windows)
  AI-engine/dist/ai-engine      (macOS / Linux)

Tauri then picks it up via the `externalBin` entry in tauri.conf.json.
"""

import sys
from pathlib import Path

ROOT = Path(SPECPATH)

a = Analysis(
    # Entry point — wraps uvicorn so the compiled binary accepts --host/--port
    [str(ROOT / "main_bundle.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        # ChromaDB internals
        "chromadb",
        "chromadb.api",
        "chromadb.db",
        "chromadb.segment",
        # LangGraph
        "langgraph",
        "langchain_core",
        # FastAPI / Uvicorn
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "pydantic",
        "starlette",
        # Other
        "diskcache",
        "jinja2",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude heavy unused packages
        "matplotlib",
        "PIL",
        "tkinter",
        "notebook",
        "IPython",
        "jupyter",
        "scipy",
        "sklearn",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="ai-engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,       # Keep console so logs are visible
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
