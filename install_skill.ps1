# Install ui-ux-pro-max skill into Claude Cowork
# Run this script once in PowerShell to install the skill

$src  = "$env:APPDATA\Claude\local-agent-mode-sessions\99b9eb34-d805-4fd2-8e95-4fb8ea5a46c9\3e28e0ca-4ad3-4475-a225-156ad6d6068a\local_0f9c889d-0c5d-4734-b1d7-c4cc67e6ba22\outputs\ui-ux-pro-max"
$dest = "$env:APPDATA\Claude\local-agent-mode-sessions\skills-plugin\3e28e0ca-4ad3-4475-a225-156ad6d6068a\99b9eb34-d805-4fd2-8e95-4fb8ea5a46c9\skills\ui-ux-pro-max"

if (-not (Test-Path $src)) {
    Write-Host "ERROR: Source skill folder not found at:" -ForegroundColor Red
    Write-Host "  $src"
    Write-Host "Make sure the outputs folder exists (Claude must have prepared it first)."
    exit 1
}

if (Test-Path $dest) {
    Remove-Item $dest -Recurse -Force
    Write-Host "Removed existing skill folder." -ForegroundColor Yellow
}

Copy-Item -Path $src -Destination $dest -Recurse -Force
Write-Host ""
Write-Host "Skill installed successfully!" -ForegroundColor Green
Write-Host "Path: $dest"
Write-Host ""
Write-Host "Restart Claude Cowork to load the new skill."
