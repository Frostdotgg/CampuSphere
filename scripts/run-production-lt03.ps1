[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-03 is locked to https://campusphere-cspc.vercel.app.'
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
      throw 'LT-03 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Write-SafeLt03Diagnostics {
  param([string]$SummaryPath)

  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-03 safe diagnostics (counts; no response bodies or credentials):'
    $metricNames = @(
      'lt03_diag_auth_responses',
      'lt03_diag_redirect_responses',
      'lt03_diag_network_errors',
      'lt03_diag_other_client_errors',
      'lt03_diag_server_errors',
      'lt03_diag_other_responses',
      'lt03_diag_browser_auth',
      'lt03_diag_browser_redirect',
      'lt03_diag_browser_navigation_response',
      'lt03_diag_browser_navigation_null_recovered',
      'lt03_diag_browser_navigation_null',
      'lt03_diag_browser_navigation_throw',
      'lt03_diag_browser_client_status',
      'lt03_diag_browser_server_status',
      'lt03_diag_browser_other_status',
      'lt03_diag_browser_render',
      'lt03_diag_browser_wait_map_container',
      'lt03_diag_browser_wait_map_surface',
      'lt03_diag_browser_wait_start_label',
      'lt03_diag_browser_check_url',
      'lt03_diag_browser_check_status',
      'lt03_diag_browser_check_surface',
      'lt03_diag_browser_check_start_label',
      'lt03_diag_browser_check_building_labels',
      'lt03_diag_browser_check_route_controls',
      'lt03_diag_browser_unexpected'
    )
    foreach ($name in $metricNames) {
      $property = $summaryObject.metrics.PSObject.Properties |
        Where-Object { $_.Name -eq $name } |
        Select-Object -First 1
      # k6 omits a Counter whose value stayed at zero. Treat that omission as
      # zero samples, while retaining "unavailable" only for a malformed or
      # unreadable summary property.
      $count = '0 (no samples recorded)'
      if ($null -ne $property -and $null -ne $property.Value.values.count) {
        $count = [string]$property.Value.values.count
      } elseif ($null -eq $property) {
        $count = '0 (no samples recorded)'
      }
      Write-Host ('  {0}: {1}' -f $name, $count)
    }
  } catch {
    Write-Warning 'LT-03 safe diagnostics could not be read from summary.json.'
  }
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-03 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts 199 HTTP users plus 1 browser canary against Production. Type RUN-LT-03 to continue'
  if ($confirmation -cne 'RUN-LT-03') { throw 'LT-03 was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-03' "run-$runId"))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$mapPng = Join-Path $artifactDir 'lt-03-map-peak.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-03-peak-enrollment.js'
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
foreach ($name in @('BASE_URL','K6_TEST_EMAIL','K6_TEST_PASSWORD','K6_PAGE_SCREENSHOT_PATH','K6_SUMMARY_PATH','K6_WEB_DASHBOARD','K6_WEB_DASHBOARD_EXPORT','K6_WEB_DASHBOARD_PORT','K6_WEB_DASHBOARD_PERIOD','K6_BROWSER_ARGS','K6_BROWSER_EXECUTABLE_PATH')) {
  $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name)
}

try {
  $env:BASE_URL = $BaseUrl
  $env:K6_TEST_EMAIL = $email
  $env:K6_TEST_PASSWORD = $password
  $env:K6_PAGE_SCREENSHOT_PATH = $mapPng
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

  Write-SafeLt03Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $metadataObject = [ordered]@{
    test_case = 'LT-03'
    target = $BaseUrl
    total_concurrent_users = 200
    http_users_peak = 199
    browser_canary_users = 1
    session_pool_size = 4
    authentication_model = 'four sequential setup logins in four independent local k6 cookie jars; 199 HTTP users and one browser canary share the four temporary guest sessions'
    distinct_accounts = 1
    distinct_sessions = 4
    ramp_profile = '10/50/100/150/199/199/0 over 14 minutes; three-minute peak hold'
    browser_settle_ms = 3000
    presence_heartbeat = 'fulfilled locally by the browser canary; not sent to Production'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-03-peak-enrollment.js'
    note = 'The k6 summary is sanitized to omit setup data; dashboard, peak browser screenshot, transcript, metadata, and hashes are retained together.'
  }
  $metadataObject | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8

  if ($browserPath -and $dashboardExported) {
    $dashboardUri = ([Uri]$dashboard).AbsoluteUri
    & $browserPath --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2400 "--screenshot=$dashboardPng" $dashboardUri | Out-Null
  } else {
    Write-Warning 'The official k6 dashboard screenshot could not be started.'
  }

  $privacyViolation = $false
  foreach ($evidenceFile in Get-ChildItem -LiteralPath $artifactDir -File -ErrorAction SilentlyContinue) {
    $evidenceText = Get-Content -Raw -LiteralPath $evidenceFile.FullName -ErrorAction SilentlyContinue
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD') {
      $privacyViolation = $true
    }
  }
  if ($privacyViolation) { throw 'LT-03 evidence privacy validation failed.' }

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-03 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng, $mapPng)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-03 completed without required real screenshot evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-03 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
