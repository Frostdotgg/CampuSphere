[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation,
  [switch]$AllowKnownK6OfflineDiagnostic
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-07 is locked to https://campusphere-cspc.vercel.app.'
}

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw 'k6 is not on PATH.'
}

if (-not $AllowKnownK6OfflineDiagnostic) {
  throw @'
LT-07 final evidence must use a real Chrome tab and the browser's network-offline
control. The retained k6 script is diagnostic-only: k6 v2.2.0 cannot navigate
even a minimal service-worker fixture to its cached offline shell after the
browser context is switched offline. Re-run this prototype only with
-AllowKnownK6OfflineDiagnostic; its result is not an LT-07 application verdict.
'@
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactBase = Join-Path $repoRoot 'artifacts\production-load'

function Get-LatestProductionLoadFinish {
  param([string]$Root)

  if (-not (Test-Path -LiteralPath $Root)) { return $null }
  $latest = $null
  $metadataFiles = Get-ChildItem -LiteralPath $Root -Recurse -Filter 'metadata.json' -File -ErrorAction SilentlyContinue
  foreach ($metadataFile in $metadataFiles) {
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
      throw 'LT-07 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Write-SafeLt07Diagnostics {
  param([string]$SummaryPath)

  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-07 safe diagnostics (fixed counts; no response bodies, URLs, names, cookies, or credentials):'
    $metricNames = @(
      'lt07_service_worker_version',
      'lt07_device_success',
      'lt07_download_success',
      'lt07_offline_recovery_success',
      'lt07_entry_route_success',
      'lt07_exit_route_success',
      'lt07_reconnect_success',
      'lt07_diag_browser_check_failures',
      'lt07_diag_browser_auth',
      'lt07_diag_browser_redirect',
      'lt07_diag_browser_network',
      'lt07_diag_browser_client_status',
      'lt07_diag_browser_server_status',
      'lt07_diag_browser_other_status',
      'lt07_diag_browser_render',
      'lt07_diag_browser_unexpected',
      'lt07_diag_offline_forbidden_resources',
      'lt07_diag_offline_shell_cache_missing',
      'lt07_diag_offline_controller_missing',
      'lt07_diag_offline_navigation_unsettled',
      'lt07_diag_offline_page_unreadable',
      'lt07_diag_offline_workspace_hidden'
    )
    foreach ($name in $metricNames) {
      $property = $summaryObject.metrics.PSObject.Properties |
        Where-Object { $_.Name -eq $name } |
        Select-Object -First 1
      $value = '0 (no samples recorded)'
      if ($null -ne $property -and $null -ne $property.Value.values.count) {
        $value = [string]$property.Value.values.count
      } elseif ($null -ne $property -and $null -ne $property.Value.values.rate) {
        $value = ('rate={0}' -f $property.Value.values.rate)
      } elseif ($null -ne $property -and $null -ne $property.Value.values.avg) {
        $value = ('avg={0}' -f $property.Value.values.avg)
      }
      Write-Host ('  {0}: {1}' -f $name, $value)
    }
  } catch {
    Write-Warning 'LT-07 safe diagnostics could not be read from summary.json.'
  }
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-07 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts the known-limited k6 LT-07 diagnostic against Production. Type RUN-LT-07-DIAGNOSTIC to continue'
  if ($confirmation -cne 'RUN-LT-07-DIAGNOSTIC') { throw 'LT-07 diagnostic was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-07' "run-$runId"))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$privacyScan = Join-Path $artifactDir 'privacy-scan.txt'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-07-offline-recovery.js'
$runStartedUtc = $null

$browserCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

$email = Read-Host 'Dedicated guest test email'
$securePassword = Read-Host 'Dedicated guest test password' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = $null
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
}

$offlineScreenshots = @(
  (Join-Path $artifactDir 'lt-07-desktop-offline.png'),
  (Join-Path $artifactDir 'lt-07-desktop-reconnected.png'),
  (Join-Path $artifactDir 'lt-07-tablet-offline.png'),
  (Join-Path $artifactDir 'lt-07-tablet-reconnected.png'),
  (Join-Path $artifactDir 'lt-07-phone-offline.png'),
  (Join-Path $artifactDir 'lt-07-phone-reconnected.png')
)

$oldEnv = @{}
foreach ($name in @(
  'BASE_URL',
  'K6_TEST_EMAIL',
  'K6_TEST_PASSWORD',
  'K6_LT07_SCREENSHOT_DIR',
  'K6_SUMMARY_PATH',
  'K6_WEB_DASHBOARD',
  'K6_WEB_DASHBOARD_EXPORT',
  'K6_WEB_DASHBOARD_PORT',
  'K6_WEB_DASHBOARD_PERIOD',
  'K6_BROWSER_ARGS',
  'K6_BROWSER_EXECUTABLE_PATH'
)) {
  $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name)
}

try {
  $env:BASE_URL = $BaseUrl
  $env:K6_TEST_EMAIL = $email
  $env:K6_TEST_PASSWORD = $password
  $env:K6_LT07_SCREENSHOT_DIR = $artifactDir
  $env:K6_SUMMARY_PATH = $summary
  $env:K6_WEB_DASHBOARD = 'true'
  $env:K6_WEB_DASHBOARD_EXPORT = $dashboard
  $env:K6_WEB_DASHBOARD_PORT = '-1'
  $env:K6_WEB_DASHBOARD_PERIOD = '1s'
  $env:K6_BROWSER_ARGS = 'disable-extensions,disable-component-extensions-with-background-pages,disable-crash-reporter,disable-breakpad'
  if ($browserPath) { $env:K6_BROWSER_EXECUTABLE_PATH = $browserPath }

  $runStartedUtc = [DateTime]::UtcNow
  $started = $runStartedUtc.ToString('o')
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $transcriptWriter = [IO.StreamWriter]::new($transcript, $false, [Text.Encoding]::UTF8)
    try {
      & k6 run `
        $scriptPath 2>&1 | ForEach-Object {
          $line = $_.ToString()
          $transcriptWriter.WriteLine($line)
          $transcriptWriter.Flush()
          Write-Host $line
        }
    } finally {
      $transcriptWriter.Dispose()
    }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $finished = [DateTime]::UtcNow.ToString('o')

  Write-SafeLt07Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $serviceWorkerVersion = $null
  if (Test-Path -LiteralPath $summary) {
    try {
      $summaryObject = Get-Content -Raw -LiteralPath $summary | ConvertFrom-Json
      $swMetric = $summaryObject.metrics.PSObject.Properties |
        Where-Object { $_.Name -eq 'lt07_service_worker_version' } |
        Select-Object -First 1
      if ($null -ne $swMetric -and $null -ne $swMetric.Value.values.avg) {
        $serviceWorkerVersion = [int][math]::Round([double]$swMetric.Value.values.avg)
      }
    } catch { $serviceWorkerVersion = $null }
  }

  $metadataObject = [ordered]@{
    test_case = 'LT-07'
    target = $BaseUrl
    browser_profiles = 'desktop 1440x900; tablet 820x1180; phone 390x844'
    browser_contexts = 3
    authentication_model = 'one dedicated guest login in setup; the session cookie is copied into three isolated Chromium contexts; the current Chrome window is not reused'
    offline_state = 'each context owns separate IndexedDB and service-worker state; download/update uses the explicit authenticated /api/offline-guide request'
    expected_downloads = 3
    expected_offline_recoveries = 3
    expected_entry_routes = 3
    expected_exit_routes = 3
    expected_reconnect_updates = 3
    service_worker_version_observed = $serviceWorkerVersion
    offline_scope = '2D map, building information, and saved Main Gate entry/exit routes only; VR panoramas, scenes, photos, schedules, sessions, and admin data are excluded'
    timing_guards = 'download p95 <60s; offline-ready p95 <30s; reconnect/update p95 <30s'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-07-offline-recovery.js'
    evidence_class = 'diagnostic-only; not an LT-07 application verdict'
    note = 'Retained text evidence and diagnostics contain no credentials, cookies, response bodies, panorama URLs, building names, route keys, or setup data. Screenshots are UI evidence and may show public campus labels. k6 v2.2.0 offline navigation is a known harness limitation reproduced against a minimal localhost service-worker fixture; final LT-07 evidence must use real Chrome network-offline control.'
  }
  $metadataObject | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8

  if ($browserPath -and $dashboardExported) {
    $dashboardUri = ([Uri]$dashboard).AbsoluteUri
    & $browserPath --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2400 "--screenshot=$dashboardPng" $dashboardUri | Out-Null
  } else {
    Write-Warning 'The official k6 dashboard screenshot could not be started.'
  }

  $privacyViolation = $false
  $textEvidence = Get-ChildItem -LiteralPath $artifactDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in @('.txt', '.json', '.html') }
  foreach ($evidenceFile in $textEvidence) {
    $evidenceText = Get-Content -Raw -LiteralPath $evidenceFile.FullName -ErrorAction SilentlyContinue
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD|csrfToken|_csrf' -or
        (-not [string]::IsNullOrEmpty($email) -and $evidenceText.Contains($email)) -or
        (-not [string]::IsNullOrEmpty($password) -and $evidenceText.Contains($password))) {
      $privacyViolation = $true
    }
  }
  if ($privacyViolation) { throw 'LT-07 evidence privacy validation failed.' }
  'PASS - retained text evidence contains no credential, session-cookie, CSRF, or setup-data marker.' |
    Set-Content -LiteralPath $privacyScan -Encoding ASCII

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-07 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng, $metadata, $privacyScan, $hashes) + $offlineScreenshots) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-07 completed without required fresh evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-07 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
