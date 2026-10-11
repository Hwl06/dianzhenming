Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $appDir 'backup'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$dataDir = Join-Path $appDir 'data'
if (-not (Test-Path -LiteralPath $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
$target = Join-Path $backupDir "电诊明-$stamp.zip"
$files = @('data','knowledge','rag','ingest','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','test-rag.mjs','index.html','app.js','rules.js','app.mjs','rules.mjs','server.mjs','.env.example','README.md','SECURITY.md','CHANGELOG.md','smoke-test.mjs','start.ps1','stop.ps1','verify.ps1','backup.ps1')
$paths = $files | ForEach-Object { Join-Path $appDir $_ } | Where-Object { Test-Path -LiteralPath $_ }
Compress-Archive -LiteralPath $paths -DestinationPath $target -Force
Write-Host "已备份到 $target（不含 .env）"


