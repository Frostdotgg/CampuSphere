[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-08 is locked to https://campusphere-cspc.vercel.app.'
}
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw 'k6 is not on PATH.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactBase = Join-Path $repoRoot 'artifacts\production-load'

function Get-LatestProductionLoadFinish {
  param([string]$Root)
  if (-not (Test-Path -LiteralPath $Root)) { return $null }
  $latest = $null
  foreach ($metadataFile in Get-ChildItem -LiteralPath $Root -Recurse -Filter 'metadata.json' -File -ErrorAction SilentlyContinue) {
    try {
      $metadataObject = Get-Content -Raw -LiteralPath $metadataFile.FullName | ConvertFrom-Json
      if ($metadataObject.test_case -notin @('LT-01', 'LT-02', 'LT-03', 'LT-04', 'LT-05', 'LT-06', 'LT-07', 'LT-08')) { continue }
      if ([string]::IsNullOrWhiteSpace([string]$metadataObject.finished_at_utc)) { throw 'missing finish time' }
      $finished = [DateTime]::Parse(
        [string]$metadataObject.finished_at_utc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      ).ToUniversalTime()
      if ($null -eq $latest -or $finished -gt $latest) { $latest = $finished }
    } catch {
      throw 'LT-08 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Get-SummaryMetric {
  param([object]$Summary, [string]$Name)
  if ($null -eq $Summary -or $null -eq $Summary.metrics) { return $null }
  $property = $Summary.metrics.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if ($null -eq $property) { return $null }
  return $property.Value.values
}

function Write-SafeLt08Diagnostics {
  param([string]$SummaryPath)
  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-08 safe diagnostics (fixed counts; no response bodies, URLs, names, cookies, or credentials):'
    $metricNames = @(
      'lt08_setup_route_candidates', 'lt08_setup_route_selected', 'lt08_setup_invalid_responses',
      'lt08_completed_journeys', 'lt08_browser_cycles', 'lt08_journey_success',
      'lt08_http_5xx', 'lt08_rate_limited', 'lt08_diag_auth_responses',
      'lt08_diag_redirect_responses', 'lt08_diag_network_errors', 'lt08_diag_other_client_errors',
      'lt08_diag_server_errors', 'lt08_diag_other_responses', 'lt08_diag_browser_auth',
      'lt08_diag_browser_redirect', 'lt08_diag_browser_network', 'lt08_diag_browser_client_status',
      'lt08_diag_browser_server_status', 'lt08_diag_browser_other_status',
      'lt08_diag_browser_render', 'lt08_diag_browser_unexpected',
      'lt08_diag_browser_navigation_response', 'lt08_diag_browser_navigation_null',
      'lt08_diag_browser_navigation_null_recovered', 'lt08_diag_browser_navigation_throw'
    )
    foreach ($name in $metricNames) {
      $values = Get-SummaryMetric -Summary $summaryObject -Name $name
      $value = '0 (no samples recorded)'
      if ($null -ne $values -and $null -ne $values.count) { $value = [string]$values.count }
      elseif ($null -ne $values -and $null -ne $values.rate) { $value = ('rate={0}' -f $values.rate) }
      Write-Host ('  {0}: {1}' -f $name, $value)
    }
  } catch {
    Write-Warning 'LT-08 safe diagnostics could not be read from summary.json.'
  }
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-08 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts 49 HTTP endurance users plus 1 Chromium canary against Production. Type RUN-LT-08 to continue'
  if ($confirmation -cne 'RUN-LT-08') { throw 'LT-08 was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-08' "run-$runId"))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$peakPng = Join-Path $artifactDir 'lt-08-peak.png'
$finalPng = Join-Path $artifactDir 'lt-08-final.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$privacyScan = Join-Path $artifactDir 'privacy-scan.txt'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-08-sustained-endurance.js'
$runStartedUtc = $null

$browserCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files\Microsoft\Edge\msedge.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browserPath) {
  throw 'LT-08 requires a local Chrome or Edge executable for dashboard evidence.'
}

$email = Read-Host 'Dedicated guest test email'
$securePassword = Read-Host 'Dedicated guest test password' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = $null
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr) }

$oldEnv = @{}
foreach ($name in @(
  'BASE_URL', 'K6_TEST_EMAIL', 'K6_TEST_PASSWORD', 'K6_PEAK_SCREENSHOT_PATH',
  'K6_FINAL_SCREENSHOT_PATH', 'K6_SUMMARY_PATH', 'K6_WEB_DASHBOARD',
  'K6_WEB_DASHBOARD_EXPORT', 'K6_WEB_DASHBOARD_PORT', 'K6_WEB_DASHBOARD_PERIOD',
  'K6_BROWSER_ARGS', 'K6_BROWSER_EXECUTABLE_PATH'
)) { $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name) }

try {
  $env:BASE_URL = $BaseUrl
  $env:K6_TEST_EMAIL = $email
  $env:K6_TEST_PASSWORD = $password
  $env:K6_PEAK_SCREENSHOT_PATH = $peakPng
  $env:K6_FINAL_SCREENSHOT_PATH = $finalPng
  $env:K6_SUMMARY_PATH = $summary
  $env:K6_WEB_DASHBOARD = 'true'
  $env:K6_WEB_DASHBOARD_EXPORT = $dashboard
  $env:K6_WEB_DASHBOARD_PORT = '-1'
  $env:K6_WEB_DASHBOARD_PERIOD = '1s'
  $env:K6_BROWSER_ARGS = 'disable-extensions,disable-component-extensions-with-background-pages,disable-crash-reporter,disable-breakpad'
  $env:K6_BROWSER_EXECUTABLE_PATH = $browserPath

  $runStartedUtc = [DateTime]::UtcNow
  $started = $runStartedUtc.ToString('o')
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $transcriptWriter = [IO.StreamWriter]::new($transcript, $false, [Text.Encoding]::UTF8)
    try {
      & k6 run $scriptPath 2>&1 | ForEach-Object {
        $line = $_.ToString()
        $transcriptWriter.WriteLine($line)
        $transcriptWriter.Flush()
        Write-Host $line
      }
    } finally { $transcriptWriter.Dispose() }
    $exitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousErrorActionPreference }
  $finished = [DateTime]::UtcNow.ToString('o')

  Write-SafeLt08Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
  $summaryObject = if (Test-Path -LiteralPath $summary) { Get-Content -Raw -LiteralPath $summary | ConvertFrom-Json } else { $null }
  $early = Get-SummaryMetric -Summary $summaryObject -Name 'lt08_dynamic_duration_early_ms'
  $late = Get-SummaryMetric -Summary $summaryObject -Name 'lt08_dynamic_duration_late_ms'
  $earlyP95 = if ($null -ne $early -and $null -ne $early.'p(95)') { [double]$early.'p(95)' } else { $null }
  $lateP95 = if ($null -ne $late -and $null -ne $late.'p(95)') { [double]$late.'p(95)' } else { $null }
  $lateLimit = if ($null -ne $earlyP95) { [math]::Max($earlyP95 * 1.5, $earlyP95 + 500) } else { $null }
  $degradationPass = $null -ne $earlyP95 -and $null -ne $lateP95 -and $lateP95 -le $lateLimit

  $metadataObject = [ordered]@{
    test_case = 'LT-08'
    target = $BaseUrl
    total_concurrent_users = 50
    http_users_peak = 49
    browser_canary_users = 1
    session_pool_size = 4
    duration = '10-minute hold at 49 HTTP users after a 2-minute ramp; 1-minute ramp-down'
    authentication_model = 'four sequential setup logins in independent local k6 cookie jars; 49 HTTP users and one browser canary share four temporary guest sessions'
    workload = 'authenticated read-only map, Buildings page, directory, search, route catalog, Main Gate pathfinding, and health checks; no writes, presence, offline, admin, or media-management requests'
    browser_canary = 'one Chromium map canary every 60 seconds with local presence-heartbeat stub'
    latency_guard = 'overall and early/middle/late p95 <3000ms; p99 <8000ms; late p95 <= max(early p95 * 1.5, early p95 + 500ms)'
    early_p95_ms = $earlyP95
    late_p95_ms = $lateP95
    late_degradation_guard = $degradationPass
    vercel_memory_evidence = 'pending owner review in Observability; k6 does not measure server memory'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-08-sustained-endurance.js'
    note = 'Retained text evidence contains aggregate counts, fixed diagnostics, and timings only; no credentials, cookies, CSRF values, session identifiers, response bodies, search names, or route data.'
  }
  $metadataObject | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8

  if ($browserPath -and $dashboardExported) {
    $dashboardUri = ([Uri]$dashboard).AbsoluteUri
    & $browserPath --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2400 "--screenshot=$dashboardPng" $dashboardUri | Out-Null
  } else { Write-Warning 'The official k6 dashboard screenshot could not be started.' }

  $privacyViolation = $false
  foreach ($evidenceFile in Get-ChildItem -LiteralPath $artifactDir -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in @('.txt', '.json', '.html') }) {
    $evidenceText = Get-Content -Raw -LiteralPath $evidenceFile.FullName -ErrorAction SilentlyContinue
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD|csrfToken|_csrf' -or
        (-not [string]::IsNullOrEmpty($email) -and $evidenceText.Contains($email)) -or
        (-not [string]::IsNullOrEmpty($password) -and $evidenceText.Contains($password))) { $privacyViolation = $true }
  }
  if ($privacyViolation) { throw 'LT-08 evidence privacy validation failed.' }
  'PASS - retained text evidence contains no credential, session-cookie, CSRF, or setup-data marker.' |
    Set-Content -LiteralPath $privacyScan -Encoding ASCII

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-08 failed with exit code $exitCode. See $transcript." }
  if (-not $degradationPass) { throw "LT-08 late-window latency guard failed. See $summary." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng, $peakPng, $finalPng, $metadata, $privacyScan, $hashes)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) { throw "LT-08 completed without required fresh evidence: $($missingEvidence -join ', ')." }
  Write-Host "LT-08 k6 run completed. Evidence: $artifactDir"
  Write-Host 'Next: review the exact run window in Vercel Observability for Peak Memory p99, OOM/crash/timeout signals, and runtime-log 5xx/error status before recording LT-08 as a final PASS.'
} finally {
  foreach ($name in $oldEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $oldEnv[$name]) }
  $password = $null
  $email = $null
}
