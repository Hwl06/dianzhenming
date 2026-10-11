Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
Set-Location -LiteralPath $appDir
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '请先安装 Node.js 18+' }
if (-not (Test-Path -LiteralPath (Join-Path $appDir '.env'))) {
  Copy-Item -LiteralPath (Join-Path $appDir '.env.example') -Destination (Join-Path $appDir '.env')
  Write-Host '已创建 .env；可填写 QIANFAN_API_KEY。留空将使用本地规则。'
}
Write-Host '启动电诊明 v1.0.6；按 Ctrl+C 停止。'
node (Join-Path $appDir 'server.mjs')

