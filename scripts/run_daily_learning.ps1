param(
    [switch]$Collect,
    [switch]$Force,
    [string]$Trains = "",
    [int]$Interval = 0,
    [int]$Duration = 0
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Missing $Python. Run scripts\setup_windows.ps1 first."
}

$Arguments = @((Join-Path $RepoRoot "scripts\20_daily_learning.py"))
if ($Collect) { $Arguments += "--collect" }
if ($Force) { $Arguments += "--force" }
if ($Trains) { $Arguments += @("--trains", $Trains) }
if ($Interval -gt 0) { $Arguments += @("--interval", $Interval) }
if ($Duration -gt 0) { $Arguments += @("--duration", $Duration) }

& $Python @Arguments
exit $LASTEXITCODE
