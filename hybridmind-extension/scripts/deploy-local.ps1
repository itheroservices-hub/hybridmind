# deploy-local.ps1
# Compiles and syncs the extension to the installed VS Code copy.
# Run this after any code change, then reload the VS Code window.

$ErrorActionPreference = "Stop"
$src = Split-Path $PSScriptRoot -Parent
$dst = "$env:USERPROFILE\.vscode\extensions\hybridmind.hybridmind-2.0.0"

Write-Host "Compiling..." -ForegroundColor Cyan
Push-Location $src
npm run compile
Pop-Location

Write-Host "Syncing out/ ..." -ForegroundColor Cyan
robocopy "$src\out" "$dst\out" /E /IS /IT /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Syncing media/ ..." -ForegroundColor Cyan
robocopy "$src\media" "$dst\media" /E /IS /IT /NFL /NDL /NJH /NJS | Out-Null

Write-Host ""
Write-Host "Done. Reload VS Code window to see changes (Ctrl+Shift+P -> Developer: Reload Window)" -ForegroundColor Green
