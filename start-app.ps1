#!/usr/bin/env pwsh
# Start LM Studio server + Organizer app in one go

Write-Host "Starting LM Studio Server..." -ForegroundColor Green

# Try to find and start LM Studio server
$lmStudioPath = "C:\Users\$env:USERNAME\AppData\Local\LM Studio"
$serverRunning = $false

# Check if server is already running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1234/v1/models" -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ LM Studio server already running on localhost:1234" -ForegroundColor Green
        $serverRunning = $true
    }
} catch {
    Write-Host "⚠ LM Studio server not detected. Make sure it's running in LM Studio app." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Building and launching Organizer app..." -ForegroundColor Cyan

# Change to project directory
Set-Location "e:/Joe Tasks/Organizer"

# Build and launch
npm run tauri dev

# If we started the dev server, keep it running
Write-Host ""
Write-Host "App closed. To use AI features, ensure LM Studio server is running:" -ForegroundColor Yellow
Write-Host "  1. Open LM Studio" -ForegroundColor Gray
Write-Host "  2. Go to Local Server" -ForegroundColor Gray
Write-Host "  3. Click 'Start Server'" -ForegroundColor Gray
Write-Host "  4. Run this script again or use: npm run tauri dev" -ForegroundColor Gray
