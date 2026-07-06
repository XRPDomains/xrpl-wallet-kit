# deploy-vanilla-iis.ps1
#
# Build and deploy examples/vanilla to an IIS site.
#
# Usage:
#   .\scripts\deploy-vanilla-iis.ps1 -SitePath "C:\inetpub\wwwroot\xrpl-demo"
#
# Optional — set env vars before running:
#   $env:VITE_WALLETCONNECT_PROJECT_ID = "your_project_id"
#   $env:VITE_XAMAN_CLIENT_ID          = "your_client_id"
#
# Or put them in .env.local at the project root (recommended).

param(
    [Parameter(Mandatory=$true)]
    [string]$SitePath,

    [switch]$SkipBuild   # pass -SkipBuild to re-deploy without rebuilding
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=== XRPL Wallet Kit — Vanilla Example IIS Deploy ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build ────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "--> Building examples/vanilla..." -ForegroundColor Yellow
    Push-Location $ProjectRoot

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js not found. Install from https://nodejs.org"
    }

    # Run build script
    node scripts/build-vanilla.mjs
    if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }

    Pop-Location
    Write-Host "--> Build complete." -ForegroundColor Green
}

# ── Step 2: Verify dist ──────────────────────────────────────
$DistPath = Join-Path $ProjectRoot "examples\vanilla\dist"
if (-not (Test-Path (Join-Path $DistPath "index.html"))) {
    throw "dist/index.html not found. Run the build first (remove -SkipBuild)."
}

# ── Step 3: Copy to IIS site ─────────────────────────────────
Write-Host ""
Write-Host "--> Copying dist to IIS site: $SitePath" -ForegroundColor Yellow

if (-not (Test-Path $SitePath)) {
    New-Item -ItemType Directory -Path $SitePath -Force | Out-Null
    Write-Host "    Created directory: $SitePath"
}

Copy-Item -Path "$DistPath\*" -Destination $SitePath -Recurse -Force

# ── Step 4: Copy web.config ──────────────────────────────────
$WebConfig = Join-Path $ProjectRoot "examples\vanilla\web.config"
Copy-Item -Path $WebConfig -Destination $SitePath -Force
Write-Host "--> web.config copied."

# ── Done ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Deploy complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Site deployed to: $SitePath" -ForegroundColor White
Write-Host ""
Write-Host "Checklist:" -ForegroundColor Yellow
Write-Host "  [1] IIS URL Rewrite module installed?"
Write-Host "       https://www.iis.net/downloads/microsoft/url-rewrite"
Write-Host "  [2] IIS site pointing to: $SitePath"
Write-Host "  [3] Static Content feature enabled in IIS"
Write-Host "  [4] WalletConnect projectId was set in .env.local before build"
Write-Host "  [5] Domain whitelisted in WalletConnect Cloud dashboard"
Write-Host "  [6] Domain whitelisted in Xaman developer portal"
Write-Host ""
