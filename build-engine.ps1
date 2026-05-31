# build-engine.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Builds the Omni AI Engine into a standalone executable, then runs
# the full Tauri production build.
#
# Usage (from project root):
#   cd "e:\Joe Tasks\Organizer"
#   .\build-engine.ps1
#
# What it does:
#   1. Compiles AI-engine/ → AI-engine/dist/ai-engine.exe  (PyInstaller)
#   2. Renames the exe with Tauri's target-triple convention
#   3. Patches tauri.conf.json to add externalBin for this build
#   4. Runs `npm run tauri build`
#   5. Restores tauri.conf.json (removes externalBin so `tauri dev` keeps working)
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$TauriConf = "src-tauri\tauri.conf.json"

Write-Host "=== Omni Workspace — Full Production Build ===" -ForegroundColor Cyan

# ── Step 1: Build AI engine with PyInstaller ───────────────────────────────
Write-Host "`n[1/5] Checking PyInstaller..." -ForegroundColor Yellow
pip show pyinstaller >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing PyInstaller..."
    pip install pyinstaller
}

Write-Host "[2/5] Building AI engine (PyInstaller)..." -ForegroundColor Yellow
Push-Location "AI-engine"
pyinstaller ai_engine.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller build failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

$exeName    = "AI-engine\dist\ai-engine.exe"
$tripleExe  = "AI-engine\dist\ai-engine-x86_64-pc-windows-msvc.exe"
Copy-Item -Force $exeName $tripleExe
Write-Host "  Built: $tripleExe" -ForegroundColor Green

# ── Step 2: Patch tauri.conf.json to add externalBin ──────────────────────
Write-Host "`n[3/5] Patching tauri.conf.json for production bundle..." -ForegroundColor Yellow
$confRaw  = Get-Content $TauriConf -Raw
$confObj  = $confRaw | ConvertFrom-Json

# Add externalBin to bundle section
$confObj.bundle | Add-Member -MemberType NoteProperty -Name "externalBin" `
    -Value @("../ai-engine/dist/ai-engine") -Force

$patchedJson = $confObj | ConvertTo-Json -Depth 10
Set-Content $TauriConf $patchedJson -Encoding UTF8
Write-Host "  tauri.conf.json patched" -ForegroundColor Green

# ── Step 3: Run Tauri production build ────────────────────────────────────
Write-Host "`n[4/5] Running Tauri production build..." -ForegroundColor Yellow
npm run tauri build
$buildExitCode = $LASTEXITCODE

# ── Step 4: Restore tauri.conf.json (remove externalBin) ─────────────────
Write-Host "`n[5/5] Restoring tauri.conf.json for dev mode..." -ForegroundColor Yellow
$confObj.bundle.PSObject.Properties.Remove("externalBin")
$restoredJson = $confObj | ConvertTo-Json -Depth 10
Set-Content $TauriConf $restoredJson -Encoding UTF8
Write-Host "  tauri.conf.json restored" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────
if ($buildExitCode -ne 0) {
    Write-Host "`nERROR: Tauri build failed (exit $buildExitCode)." -ForegroundColor Red
    exit $buildExitCode
}

Write-Host "`n=== Build complete! ===" -ForegroundColor Cyan
Write-Host "Installer is in: src-tauri\target\release\bundle\" -ForegroundColor White
