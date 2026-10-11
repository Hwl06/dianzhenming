Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
$pidFile = Join-Path (Join-Path $appDir 'data') 'server.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host '未找到本目录服务 PID；没有停止任何进程。'; exit 0 }
try { $expectedPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim() } catch { Write-Host 'PID 文件无效；请检查服务状态。'; exit 1 }
$conn = Get-NetTCPConnection -LocalPort 8788 -State Listen -ErrorAction SilentlyContinue | Where-Object OwningProcess -eq $expectedPid
if (-not $conn) { Write-Host '本目录服务未监听 8788；没有停止任何进程。'; exit 0 }
$proc = Get-CimInstance Win32_Process -Filter "ProcessId = $expectedPid" -ErrorAction SilentlyContinue
if (-not $proc -or $proc.Name -notmatch '^node(\.exe)?$' -or $proc.CommandLine -notmatch 'server\.mjs') { throw 'PID 与 Node server.mjs 不匹配，拒绝停止。' }
Stop-Process -Id $expectedPid -Force
Write-Host '已停止本目录电诊明服务。'

