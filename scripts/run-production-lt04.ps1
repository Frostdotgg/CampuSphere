[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [string[]]$AssetUrls = @(),
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-04 is locked to https://campusphere-cspc.vercel.app.'
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
      throw 'LT-04 could not verify the previous Production load-test cooldown.'
    }
  }
  return $latest
}

function Write-SafeLt04Diagnostics {
  param([string]$SummaryPath)

  if (-not (Test-Path -LiteralPath $SummaryPath)) { return }
  try {
    $summaryObject = Get-Content -Raw -LiteralPath $SummaryPath | ConvertFrom-Json
    Write-Host ''
    Write-Host 'LT-04 safe diagnostics (counts; no response bodies, URLs, or credentials):'
    $metricNames = @(
      'lt04_setup_route_responses',
      'lt04_setup_route_failures',
      'lt04_setup_routes_no_scenes',
      'lt04_setup_scenes',
      'lt04_setup_cloudinary_urls',
      'lt04_setup_explicit_cloudinary_urls',
      'lt04_setup_local_urls',
      'lt04_setup_drive_urls',
      'lt04_setup_null_urls',
      'lt04_setup_other_urls',
      'lt04_asset_requests',
      'lt04_asset_success',
      'lt04_asset_no_response',
      'lt04_asset_redirects',
      'lt04_asset_client_errors',
      'lt04_asset_server_errors',
      'lt04_asset_other_status',
      'lt04_asset_content_type_failures'
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
    Write-Warning 'LT-04 safe diagnostics could not be read from summary.json.'
  }
}

function Normalize-ExplicitAssetUrls {
  param([string[]]$Values)

  $normalized = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    try {
      $uri = [Uri]$value.Trim()
    } catch {
      throw 'LT-04 explicit asset targets must be valid absolute HTTPS URLs.'
    }
    if ($uri.Scheme -ne 'https' -or
      $uri.Host -ine 'res.cloudinary.com' -or
      -not [string]::IsNullOrEmpty($uri.UserInfo) -or
      -not $uri.IsDefaultPort) {
      throw 'LT-04 explicit asset targets must use https://res.cloudinary.com without credentials or a custom port.'
    }
    if ($seen.Add($uri.AbsoluteUri)) { $normalized.Add($uri.AbsoluteUri) }
  }
  return @($normalized)
}

$explicitAssetUrls = Normalize-ExplicitAssetUrls -Values $AssetUrls
if ($explicitAssetUrls.Count -gt 0 -and $explicitAssetUrls.Count -lt 5) {
  throw 'LT-04 requires at least five unique explicit Cloudinary asset URLs.'
}

$latestFinish = Get-LatestProductionLoadFinish -Root $artifactBase
if ($null -ne $latestFinish) {
  $elapsedMinutes = ([DateTime]::UtcNow - $latestFinish).TotalMinutes
  if ($elapsedMinutes -lt 16) {
    $remainingSeconds = [math]::Ceiling((16 - $elapsedMinutes) * 60)
    throw "LT-04 requires a 16-minute Production load-test cooldown. Wait approximately $remainingSeconds seconds."
  }
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts 5 concurrent Cloudinary panorama users and 10 total asset requests against Production. Type RUN-LT-04 to continue'
  if ($confirmation -cne 'RUN-LT-04') { throw 'LT-04 was not started.' }
}

if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $artifactBase (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-04' "run-$runId"))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-04-vr-assets.js'
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
foreach ($name in @('BASE_URL','K6_TEST_EMAIL','K6_TEST_PASSWORD','K6_SUMMARY_PATH','K6_LT04_ASSET_URLS','K6_WEB_DASHBOARD','K6_WEB_DASHBOARD_EXPORT','K6_WEB_DASHBOARD_PORT','K6_WEB_DASHBOARD_PERIOD')) {
  $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name)
}

try {
  $env:BASE_URL = $BaseUrl
  $env:K6_TEST_EMAIL = $email
  $env:K6_TEST_PASSWORD = $password
  $env:K6_LT04_ASSET_URLS = ($explicitAssetUrls | ConvertTo-Json -Compress)
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

  Write-SafeLt04Diagnostics -SummaryPath $summary

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $metadataObject = [ordered]@{
    test_case = 'LT-04'
    target = $BaseUrl
    delivery_host = 'res.cloudinary.com'
    asset_vus = 5
    asset_requests_target = 10
    route_probe_limit = if ($explicitAssetUrls.Count -gt 0) { 0 } else { 25 }
    asset_pool_minimum = 5
    asset_pool_maximum = 10
    asset_pool_source = if ($explicitAssetUrls.Count -gt 0) { 'explicit-cloudinary-override' } else { 'production-guided-vr-route-discovery' }
    explicit_asset_count = $explicitAssetUrls.Count
    request_timeout_ms = 30000
    authentication_model = 'one sequential setup login with one temporary guest session; the asset workload sends no application cookie'
    distinct_accounts = 1
    distinct_sessions = 1
    workload = 'ten direct approved Cloudinary panorama GETs with at most five simultaneous transfers; no cache busting or upload'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-04-vr-assets.js'
    note = 'The k6 summary omits setup data; evidence records aggregate counts and timings only, never panorama URLs, cookies, tokens, response bodies, or credentials.'
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
    if ($evidenceText -match 'setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD|csrfToken|_csrf') {
      $privacyViolation = $true
    }
  }
  if ($privacyViolation) { throw 'LT-04 evidence privacy validation failed.' }

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-04 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($summary, $transcript, $dashboardPng)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-04 completed without required dashboard evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-04 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
