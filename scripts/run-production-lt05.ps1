[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-05 is locked to https://campusphere-cspc.vercel.app.'
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
  $metadataFiles = Get-ChildItem -LiteralPath $Root -Recurse -Filter 'metadata.json' -File -ErrorAction SilentlyContinue
  foreach ($metadataFile in $metadataFiles) {
    try {
      $metadataObject = Get-Content -Raw -LiteralPath $metadataFile.FullName | ConvertFrom-Json
      if ($metadataObject.test_case -notin @('LT-01', 'LT-02', 'LT-03', 'LT-04', 'LT-05', 'LT-06', 'LT-07', 'LT-08')) { continue }
      if ([string]::IsNullOrWhiteSpace([string]$metadataObject.finished_at_utc)) {
        throw 'missing finish time'
      }
      $finished = [DateTime]::Parse(
        [string]$metadataObject.finished_at_utc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      ).ToUniversalTime()
      if ($null -eq $latest -or $finished -gt $latest) { $latest = $finished }
    } catch {
      throw 'LT-05 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Write-SafeLt05Diagnostics {
  param([string]$SummaryPath)

  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-05 safe diagnostics (fixed counts; no response bodies or credentials):'
    $metricNames = @(
      'lt05_setup_query_candidates',
      'lt05_setup_query_selected',
      'lt05_setup_query_rejected_ambiguous',
      'lt05_setup_query_rejected_missing_exact',
      'lt05_setup_query_invalid_response',
      'lt05_diag_auth_responses',
      'lt05_diag_redirect_responses',
      'lt05_diag_network_errors',
      'lt05_diag_other_client_errors',
      'lt05_diag_server_errors',
      'lt05_diag_other_responses',
      'lt05_diag_invalid_json',
      'lt05_diag_catalog_mismatch',
      'lt05_diag_missing_exact_building',
      'lt05_diag_unrelated_result',
      'lt05_diag_browser_auth',
      'lt05_diag_browser_redirect',
      'lt05_diag_browser_network',
      'lt05_diag_browser_client_status',
      'lt05_diag_browser_server_status',
      'lt05_diag_browser_other_status',
      'lt05_diag_browser_buildings_filter',
      'lt05_diag_browser_map_result',
      'lt05_diag_browser_connection_message',
      'lt05_diag_browser_marker_change',
      'lt05_diag_browser_unexpected'
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
      }
      Write-Host ('  {0}: {1}' -f $name, $value)
    }
  } catch {
    Write-Warning 'LT-05 safe diagnostics could not be read from summary.json.'
  }
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-05 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts 49 HTTP search users plus 1 browser canary against Production. Type RUN-LT-05 to continue'
  if ($confirmation -cne 'RUN-LT-05') { throw 'LT-05 was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-05' "run-$runId"))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$buildingsPng = Join-Path $artifactDir 'lt-05-buildings-search-peak.png'
$mapPng = Join-Path $artifactDir 'lt-05-map-search-peak.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$privacyScan = Join-Path $artifactDir 'privacy-scan.txt'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-05-building-search.js'
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

$oldEnv = @{}
foreach ($name in @(
  'BASE_URL',
  'K6_TEST_EMAIL',
  'K6_TEST_PASSWORD',
  'K6_BUILDINGS_SCREENSHOT_PATH',
  'K6_MAP_SCREENSHOT_PATH',
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
  $env:K6_BUILDINGS_SCREENSHOT_PATH = $buildingsPng
  $env:K6_MAP_SCREENSHOT_PATH = $mapPng
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

  Write-SafeLt05Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $metadataObject = [ordered]@{
    test_case = 'LT-05'
    target = $BaseUrl
    total_concurrent_users = 50
    http_users_peak = 49
    browser_canary_users = 1
    session_pool_size = 4
    authentication_model = 'four sequential setup logins in independent local k6 cookie jars; 49 HTTP users and one browser canary share four temporary guest sessions'
    distinct_accounts = 1
    distinct_sessions = 4
    ramp_profile = '9/24/49/49/0 HTTP users over 3 minutes 30 seconds; one-minute 50-client peak hold including the browser canary'
    query_source = 'at least five unambiguous exact building names selected by sequential authenticated setup preflight; maximum 50 candidates'
    query_preflight_pacing_ms = 200
    route_result_policy = 'route rows are allowed only when they resolve to the exact searched building; unrelated building, office, or route rows fail'
    buildings_search_model = 'client-side filter validated by the Chromium canary; each HTTP VU opens /buildings once'
    map_search_model = 'authenticated GET /api/search requests plus Chromium sidebar and marker-stability checks'
    presence_heartbeat = 'fulfilled locally by the browser canary; not sent to Production'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-05-building-search.js'
    note = 'The k6 summary omits setup data; evidence retains aggregate counts, timings, the official dashboard, and two peak browser screenshots without cookies, tokens, response bodies, or credentials.'
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
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD' -or
        (-not [string]::IsNullOrEmpty($email) -and $evidenceText.Contains($email)) -or
        (-not [string]::IsNullOrEmpty($password) -and $evidenceText.Contains($password))) {
      $privacyViolation = $true
    }
  }
  if ($privacyViolation) { throw 'LT-05 evidence privacy validation failed.' }
  'PASS - retained text evidence contains no credential, session-cookie, or setup-data marker.' |
    Set-Content -LiteralPath $privacyScan -Encoding ASCII

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-05 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng, $buildingsPng, $mapPng, $metadata, $privacyScan, $hashes)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-05 completed without required fresh evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-05 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
