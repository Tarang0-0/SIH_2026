$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$PythonExecutable = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExecutable)) {
    throw "Python environment not found. Run: powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1"
}
if (-not (Test-Path (Join-Path $FrontendRoot "node_modules"))) {
    throw "Frontend dependencies not found. Run: powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1"
}

$BackendProcess = $null
$FrontendProcess = $null

function Stop-Tree($Process) {
    if ($null -ne $Process -and -not $Process.HasExited) {
        & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
    }
}

try {
    Write-Host "Starting RailPulse backend on http://localhost:8000 ..." -ForegroundColor Cyan
    $BackendProcess = Start-Process `
        -FilePath $PythonExecutable `
        -ArgumentList @("-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000") `
        -WorkingDirectory $ProjectRoot `
        -NoNewWindow `
        -PassThru

    $BackendReady = $false
    for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
        if ($BackendProcess.HasExited) {
            throw "The backend stopped before becoming ready."
        }
        try {
            $Health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
            if ($Health.StatusCode -eq 200) {
                $BackendReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $BackendReady) {
        throw "The backend did not become ready within 30 seconds."
    }

    Write-Host "Starting RailPulse frontend on http://localhost:3000 ..." -ForegroundColor Cyan
    $FrontendProcess = Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList @("run", "dev", "--", "-p", "3000") `
        -WorkingDirectory $FrontendRoot `
        -NoNewWindow `
        -PassThru

    Start-Sleep -Seconds 2
    try { Start-Process "http://localhost:3000" } catch { }

    Write-Host "" 
    Write-Host "RailPulse is running." -ForegroundColor Green
    Write-Host "Website: http://localhost:3000"
    Write-Host "API docs: http://localhost:8000/docs"
    Write-Host "Press Ctrl+C to stop both services."

    while ($true) {
        if ($BackendProcess.HasExited) { throw "The backend process stopped." }
        if ($FrontendProcess.HasExited) { throw "The frontend process stopped." }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Tree $FrontendProcess
    Stop-Tree $BackendProcess
}
