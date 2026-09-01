param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [int]$IntervalSeconds = 5
)

$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $stamp = [DateTime]::UtcNow.ToString('o')
  docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}} mem_pct={{.MemPerc}} net={{.NetIO}} block={{.BlockIO}} pids={{.PIDs}}' |
    ForEach-Object { Add-Content -LiteralPath $OutputPath -Value ($stamp + ' ' + $_) }
  Start-Sleep -Seconds ([Math]::Max(1, $IntervalSeconds))
}
