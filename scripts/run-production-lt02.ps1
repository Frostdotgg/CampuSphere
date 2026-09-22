[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://campusphere-cspc.vercel.app',
  [string]$ArtifactRoot = '',
  [switch]$SkipProductionConfirmation
)

$ErrorActionPreference = 'Stop'

if ($BaseUrl -ne 'https://campusphere-cspc.vercel.app') {
  throw 'LT-02 is locked to https://campusphere-cspc.vercel.app.'
}

if (-not $SkipProductionConfirmation) {
  $confirmation = Read-Host 'This starts one Production setup login and 50 concurrent authenticated map browsers. Type RUN-LT-02 to continue'
  if ($confirmation -cne 'RUN-LT-02') { throw 'LT-02 was not started.' }
}

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw 'k6 is not on PATH.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
  $runId = Get-Date -Format 'HHmmssfff'
  $ArtifactRoot = Join-Path $repoRoot (Join-Path 'artifacts\production-load' (Join-Path (Get-Date -Format 'yyyy-MM-dd') (Join-Path 'LT-02' "run-$runId")))
}
$artifactDir = [IO.Path]::GetFullPath($ArtifactRoot)
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$transcript = Join-Path $artifactDir 'transcript.txt'
$summary = Join-Path $artifactDir 'summary.json'
$dashboard = Join-Path $artifactDir 'k6-dashboard.html'
$dashboardPng = Join-Path $artifactDir 'k6-dashboard.png'
$mapPng = Join-Path $artifactDir 'lt-02-map.png'
$metadata = Join-Path $artifactDir 'metadata.json'
$hashes = Join-Path $artifactDir 'SHA256SUMS.txt'
$scriptPath = Join-Path $repoRoot 'load-tests\production\lt-02-browser.js'
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
  $started = (Get-Date).ToUniversalTime().ToString('o')
  # Native k6 console messages are written to stderr. Continue lets k6 finish
  # instead of Windows PowerShell cancelling the browser run on that stream.
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $transcriptWriter = [IO.StreamWriter]::new($transcript, $false, [Text.Encoding]::UTF8)
    try {
      & k6 run `
        $scriptPath 2>&1 | ForEach-Object {
          # Windows PowerShell presents native stderr records in red even when
          # k6 is only writing normal console diagnostics. Convert the merged
          # stream to plain text for a readable console while retaining it in
          # the evidence transcript.
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
  $finished = (Get-Date).ToUniversalTime().ToString('o')

  $dashboardExported = (Test-Path -LiteralPath $dashboard) -and
    ((Get-Item -LiteralPath $dashboard).Length -gt 0) -and
    ((Get-Item -LiteralPath $dashboard).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))

  $metadataObject = [ordered]@{
    test_case = 'LT-02'
    target = $BaseUrl
    vus = 50
    iterations_per_vu = 1
    authentication_model = 'one setup login; one shared guest session cookie copied to 50 isolated browser contexts'
    distinct_accounts = 1
    distinct_sessions = 1
    presence_heartbeat = 'fulfilled locally by the k6 browser route for this map-only test; not sent to Production'
    started_at_utc = $started
    finished_at_utc = $finished
    k6_exit_code = $exitCode
    credentials_logged = $false
    source_script = 'load-tests/production/lt-02-browser.js'
    note = 'The k6 summary is sanitized to omit setup data; the transcript, dashboard export, and representative screenshots are retained together.'
  }
  $metadataObject | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8

  if ($browserPath -and $dashboardExported) {
    $dashboardUri = ([Uri]$dashboard).AbsoluteUri
    & $browserPath --headless=new --disable-gpu --hide-scrollbars --window-size=1600,2400 "--screenshot=$dashboardPng" $dashboardUri | Out-Null
  } else {
    Write-Warning 'The official k6 dashboard screenshot could not be started.'
  }

  Get-ChildItem -LiteralPath $artifactDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { '{0}  {1}' -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($artifactDir.Length + 1) } |
    Set-Content -LiteralPath $hashes -Encoding ASCII

  if ($exitCode -ne 0) { throw "k6 LT-02 failed with exit code $exitCode. See $transcript." }
  $missingEvidence = @()
  if (-not $dashboardExported) { $missingEvidence += 'fresh k6-dashboard.html' }
  foreach ($evidencePath in @($dashboardPng, $mapPng)) {
    $fresh = (Test-Path -LiteralPath $evidencePath) -and
      ((Get-Item -LiteralPath $evidencePath).Length -gt 0) -and
      ((Get-Item -LiteralPath $evidencePath).LastWriteTimeUtc -ge $runStartedUtc.AddSeconds(-1))
    if (-not $fresh) { $missingEvidence += (Split-Path -Leaf $evidencePath) }
  }
  if ($missingEvidence.Count -gt 0) {
    throw "LT-02 completed without required real screenshot evidence: $($missingEvidence -join ', ')."
  }
  Write-Host "LT-02 completed. Evidence: $artifactDir"
} finally {
  foreach ($name in $oldEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $oldEnv[$name])
  }
  $password = $null
  $email = $null
}
