Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
if (-not $env:QIANFAN_API_KEY) { throw 'Set QIANFAN_API_KEY first.' }
$serverFile = Join-Path -Path $appDir -ChildPath 'server.mjs'
node $serverFile
