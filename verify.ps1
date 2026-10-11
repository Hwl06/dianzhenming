Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8788'
$pass = 0; $fail = 0
function Check($name, $cond) {
  if ($cond) { Write-Host "  ok  $name" -ForegroundColor Green; $script:pass++ }
  else { Write-Host "FAIL  $name" -ForegroundColor Red; $script:fail++ }
}
try {
  $r = Invoke-WebRequest "$base/" -UseBasicParsing
  Check '首页 200' ($r.StatusCode -eq 200)
  Check '首页含标题' ($r.Content -match '电诊明')
  Check 'CSP script-src self' ($r.Headers['Content-Security-Policy'] -match "script-src 'self'")
  Check 'nosniff' ($r.Headers['X-Content-Type-Options'] -eq 'nosniff')
  Check 'X-Frame-Options' ($r.Headers['X-Frame-Options'] -eq 'DENY')
} catch { Check '首页和安全头' $false }
try {
  $h = Invoke-RestMethod "$base/health"
  Check 'health ok' ($h.ok -eq $true)
  Check 'version 1.0.6' ($h.version -eq '1.0.6')
  Check 'mode local/online' ($h.mode -in @('local','online'))
} catch { Check 'health' $false }
try { $c=Invoke-RestMethod "$base/api/config"; Check 'config aiEnabled' ($null -ne $c.aiEnabled) } catch { Check 'config' $false }
try { $hist=Invoke-RestMethod "$base/api/history?limit=5"; Check 'history items' ($null -ne $hist.items) } catch { Check 'history' $false }
try {
  $body=@{device='未知设备';symptom='设备运行异常';alarm='';measure=@{};safety=@{poweredOff=$true;verified=$true;locked=$true;hazard=$false}} | ConvertTo-Json -Depth 5
  $d=Invoke-RestMethod "$base/api/diagnose" -Method Post -ContentType 'application/json' -Body $body
  Check 'diagnose source' ($d.source -in @('rule','ai'))
  Check 'diagnose riskLevel' ($d.riskLevel -in @('low','medium','high'))
  Check 'diagnose timestamp' ($null -ne $d.timestamp)
} catch { Check '正常诊断' $false }
Check '日志文件存在' (Test-Path (Join-Path $PSScriptRoot 'data/server.log'))
Check '历史文件存在' (Test-Path (Join-Path $PSScriptRoot 'data/history.jsonl'))
Write-Host ""
Write-Host "$pass/$($pass+$fail) 通过"
if ($fail -gt 0) { exit 1 }

