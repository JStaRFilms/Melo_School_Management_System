# Convex Setup Script for School Management System
# Run this script from the monorepo root

Write-Host "Convex Setup for School Management System" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking Convex CLI installation..." -ForegroundColor Yellow
$convexInstalled = Get-Command convex -ErrorAction SilentlyContinue

if (-not $convexInstalled) {
    Write-Host "Convex CLI not found. Installing..." -ForegroundColor Red
    pnpm add -g convex
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install Convex CLI. Please install manually:" -ForegroundColor Red
        Write-Host "  npm install -g convex" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Convex CLI installed successfully" -ForegroundColor Green
} else {
    Write-Host "Convex CLI is already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Initializing Convex project..." -ForegroundColor Yellow
Write-Host "This will create a new Convex project or connect to an existing one." -ForegroundColor Gray
Write-Host ""

pnpm convex:dev --once

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to initialize Convex project" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Convex project initialized successfully" -ForegroundColor Green
Write-Host ""

Write-Host "Setting up environment files..." -ForegroundColor Yellow

if (-not (Test-Path "apps/teacher/.env.local")) {
    Copy-Item "apps/teacher/.env.example" "apps/teacher/.env.local"
    Write-Host "Created apps/teacher/.env.local" -ForegroundColor Green
} else {
    Write-Host "apps/teacher/.env.local already exists" -ForegroundColor Yellow
}

if (-not (Test-Path "apps/admin/.env.local")) {
    Copy-Item "apps/admin/.env.example" "apps/admin/.env.local"
    Write-Host "Created apps/admin/.env.local" -ForegroundColor Green
} else {
    Write-Host "apps/admin/.env.local already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy CONVEX_URL from the repo root .env.local into NEXT_PUBLIC_CONVEX_URL in both app .env.local files" -ForegroundColor White
Write-Host "2. Copy CONVEX_SITE_URL from the repo root .env.local into NEXT_PUBLIC_CONVEX_SITE_URL in both app .env.local files" -ForegroundColor White
Write-Host "3. Set a BETTER_AUTH_SECRET in both app .env.local files" -ForegroundColor White
Write-Host "4. Run 'pnpm dev' to start the development servers" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see packages/convex/README.md" -ForegroundColor Gray
Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
