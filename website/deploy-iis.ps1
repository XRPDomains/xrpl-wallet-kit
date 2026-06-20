# deploy-iis.ps1
# Deploy XRPL Wallet Kit docs to IIS
# Usage: .\deploy-iis.ps1 -SitePath "C:\inetpub\wwwroot\xrpl-docs"
#
# Run once on the server to set up, then run on every docs update.

param(
    [Parameter(Mandatory=$true)]
    [string]$SitePath,

    [string]$NodeVersion = "20"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> Building VitePress docs..." -ForegroundColor Cyan
Push-Location $ScriptDir

# Install deps if node_modules missing
if (-not (Test-Path "node_modules")) {
    Write-Host "    Installing dependencies..."
    npm install
}

# Build
npm run build

Pop-Location

Write-Host "==> Copying dist to IIS site: $SitePath" -ForegroundColor Cyan

# Ensure destination exists
if (-not (Test-Path $SitePath)) {
    New-Item -ItemType Directory -Path $SitePath | Out-Null
}

# Copy built files (.vitepress/dist → SitePath)
$DistPath = Join-Path $ScriptDir ".vitepress\dist"
Copy-Item -Path "$DistPath\*" -Destination $SitePath -Recurse -Force

# Copy web.config
Copy-Item -Path (Join-Path $ScriptDir "web.config") -Destination $SitePath -Force

Write-Host "==> Done! Site deployed to $SitePath" -ForegroundColor Green
Write-Host ""
Write-Host "    Remember to:" -ForegroundColor Yellow
Write-Host "    1. Install IIS URL Rewrite module if not already done"
Write-Host "    2. Point your IIS site to: $SitePath"
Write-Host "    3. Enable Static Content in IIS features"
