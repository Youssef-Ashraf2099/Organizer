#!/usr/bin/env pwsh
# Start Organizer with Gemini Web2API bootstrapped automatically

Write-Host "Starting Organizer with Gemini Web2API..." -ForegroundColor Green

Write-Host ""
Write-Host "Building and launching Organizer app..." -ForegroundColor Cyan

# Change to project directory
Set-Location "e:/Joe Tasks/Organizer"

# Build and launch
npm run tauri dev

Write-Host ""
Write-Host "App closed. The launcher now starts Gemini Web2API automatically for dev/build." -ForegroundColor Yellow
