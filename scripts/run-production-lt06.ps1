[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-06 is locked to https://campusphere-cspc.vercel.app.'
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
      throw 'LT-06 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Write-SafeLt06Diagnostics {
  param([string]$SummaryPath)

  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-06 safe diagnostics (fixed counts; no route names, scene keys, bodies, or credentials):'
    $metricNames = @(
      'lt06_setup_route_responses',
      'lt06_setup_variant_candidates',
      'lt06_setup_variants_selected',
      'lt06_setup_invalid_responses',
      'lt06_setup_scenes',
      'lt06_playbacks_completed',
      'lt06_diag_auth_responses',
      'lt06_diag_redirect_responses',
      'lt06_diag_network_errors',
      'lt06_diag_other_client_errors',
      'lt06_diag_server_errors',
      'lt06_diag_other_responses',
      'lt06_diag_invalid_route_response',
      'lt06_diag_sequence_mismatch',
      'lt06_diag_scene_page_mismatch',
      'lt06_diag_completion_mismatch'
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
    Write-Warning 'LT-06 safe diagnostics could not be read from summary.json.'
  }
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-06 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts 50 authenticated HTTP route-playback users against Production. Type RUN-LT-06 to continue'
  if ($confirmation -cne 'RUN-LT-06') { throw 'LT-06 was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-06' "run-$runId"))
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
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-06-route-playback.js'
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
  'K6_SUMMARY_PATH',
  'K6_WEB_DASHBOARD',
  'K6_WEB_DASHBOARD_EXPORT',
  'K6_WEB_DASHBOARD_PORT',
  'K6_WEB_DASHBOARD_PERIOD'
)) {
  $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name)
}

try {
  $env:BASE_URL = $BaseUrl
  $env:K6_TEST_EMAIL = $email
  $env:K6_TEST_PASSWORD = $password
  $env:K6_SUMMARY_PATH = $summary
  $env:K6_WEB_DASHBOARD = 'true'
  $env:K6_WEB_DASHBOARD_EXPORT = $dashboard
  $env:K6_WEB_DASHBOARD_PORT = '-1'
  $env:K6_WEB_DASHBOARD_PERIOD = '1s'

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

  Write-SafeLt06Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $metadataObject = [ordered]@{
    test_case = 'LT-06'
    target = $BaseUrl
    total_concurrent_users = 50
    http_users_peak = 50
    browser_canary_users = 0
    session_pool_size = 4
    expected_route_count = 25
    expected_variant_count = 75
    route_modes = 'vehicle-entry, walking-entry, walking-exit'
    authentication_model = 'four sequential setup logins in independent local k6 cookie jars; 50 HTTP users share four temporary guest sessions'
    distinct_accounts = 1
    distinct_sessions = 4
    ramp_profile = '10/25/50/50/0 HTTP users over 3 minutes 30 seconds; 90-second graceful ramp-down'
    scene_dwell_ms = 500
    sequence_policy = 'every preflight route variant must return an exact non-empty unique scene sequence and destination_reached=true; every playback rechecks the API sequence and every server-rendered scene page'
    panorama_delivery = 'not measured; panorama subresources are not requested by HTTP playback; see LT-04 for CDN delivery'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-06-route-playback.js'
    note = 'The k6 summary omits setup data; retained evidence contains aggregate counts and timings only, never route names, scene keys, URLs, cookies, tokens, response bodies, or credentials.'
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
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD|csrfToken|_csrf' -or
        (-not [string]::IsNullOrEmpty($email) -and $evidenceText.Contains($email)) -or
        (-not [string]::IsNullOrEmpty($password) -and $evidenceText.Contains($password))) {
      $privacyViolation = $true
    }
  }
  if ($privacyViolation) { throw 'LT-06 evidence privacy validation failed.' }
  'PASS - retained text evidence contains no credential, session-cookie, CSRF, or setup-data marker.' |
    Set-Content -LiteralPath $privacyScan -Encoding ASCII

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-06 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng, $metadata, $privacyScan, $hashes)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-06 completed without required evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-06 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
