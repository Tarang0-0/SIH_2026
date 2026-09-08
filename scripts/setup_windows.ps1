$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

function Require-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $Hint"
    }
}

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE"
    }
}

Require-Command "npm" "Install Node.js 20 LTS from https://nodejs.org/."

$PythonLauncher = Get-Command "py" -ErrorAction SilentlyContinue
if (-not $PythonLauncher) {
    $PythonLauncher = Get-Command "python" -ErrorAction SilentlyContinue
}
if (-not $PythonLauncher) {
    throw "Python was not found. Install Python 3.9 or newer from https://www.python.org/downloads/windows/ and enable the Python launcher."
}

$PythonExecutable = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExecutable)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    if ($PythonLauncher.Name -eq "py.exe" -or $PythonLauncher.Name -eq "py") {
        Invoke-Checked $PythonLauncher.Source @("-3", "-m", "venv", ".venv")
    } else {
        Invoke-Checked $PythonLauncher.Source @("-m", "venv", ".venv")
    }
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Invoke-Checked $PythonExecutable @("-m", "pip", "install", "--upgrade", "pip")
Invoke-Checked $PythonExecutable @("-m", "pip", "install", "-r", (Join-Path $ProjectRoot "ml\requirements.txt"))

if (-not (Test-Path (Join-Path $ProjectRoot ".env"))) {
    Copy-Item (Join-Path $ProjectRoot ".env.example") (Join-Path $ProjectRoot ".env")
    Write-Host "Created .env from .env.example. Add provider keys if needed." -ForegroundColor Yellow
}

$FrontendRoot = Join-Path $ProjectRoot "frontend"
Push-Location $FrontendRoot
try {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    if (Test-Path "package-lock.json") {
        Invoke-Checked "npm.cmd" @("ci")
    } else {
        Invoke-Checked "npm.cmd" @("install")
    }

    if (-not (Test-Path ".env.local")) {
        Copy-Item ".env.example" ".env.local"
        Write-Host "Created frontend\.env.local." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

Write-Host "" 
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Run the website with: powershell -ExecutionPolicy Bypass -File .\run_demo.ps1"
