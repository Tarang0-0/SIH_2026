# Windows setup

RailTrackr runs locally on Windows through PowerShell. Install these tools
before cloning:

- Git for Windows
- Python 3.9 or newer, with the Python launcher enabled
- Node.js 20 LTS or newer

## Clone and install

Open PowerShell and run:

```powershell
git clone https://github.com/Tarang0-0/SIH_2026.git
cd SIH_202
powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
```

The setup script creates `.venv`, installs the pinned backend dependencies,
runs `npm ci`, and creates the local `.env` and `frontend\.env.local` files.
Provider keys are optional for the offline demo.

## Run the website

```powershell
powershell -ExecutionPolicy Bypass -File .\run_demo.ps1
```

The script starts both services, waits for the API health check, and opens the
website:

- Website: <http://localhost:3000>
- API documentation: <http://localhost:8000/docs>
- API health: <http://localhost:8000/health>

Press `Ctrl+C` in the PowerShell window to stop the backend and frontend.

## Run checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
Push-Location frontend
npm run lint
npm run build
Pop-Location
```

## Troubleshooting

- If `py` or `python` is not recognized, reinstall Python and enable **Add
  python.exe to PATH** and the Python launcher.
- If `npm` is not recognized, reinstall Node.js and reopen PowerShell.
- If PowerShell blocks scripts, use the `-ExecutionPolicy Bypass` commands
  shown above; this applies only to that command.
- If port 3000 or 8000 is already in use, stop the process using that port or
  change the port in `run_demo.ps1` and the frontend API configuration.
- Live train/weather data stays unavailable until the relevant provider keys
  are added to the root `.env` file.

## Daily data refresh and model learning

The backend records successful live provider polls in
`data\railpulse_feedback.sqlite3`. To collect a small approved set of trains
and refresh verified datasets every day, configure the provider keys and these
values in `.env`:

```text
RAILPULSE_DAILY_COLLECT=true
RAILPULSE_DAILY_TRAIN_NUMBERS=12951,12952
RAILPULSE_DAILY_COLLECTION_INTERVAL_SECONDS=300
RAILPULSE_DAILY_COLLECTION_SECONDS=3600
```

Run the job once manually to verify it:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_daily_learning.ps1 -Collect
```

For Task Scheduler, create a daily task that runs at a time when this laptop
is on and connected to the internet:

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$PWD\scripts\run_daily_learning.ps1`" -Collect"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:30am
Register-ScheduledTask -TaskName "RailTrackr Daily Learning" -Action $action -Trigger $trigger -Description "Refresh verified RailTrackr data and retrain eligible models"
```

The job always rebuilds the exported datasets. It retrains only when a dataset
has changed and only from provider-confirmed labels; insufficient data is
reported as a gate instead of producing a misleading model. The report is
available at `http://localhost:8000/learning-status` and in
`reports\daily_learning_status.json`. Restart the API after a successful
training run so the new model files are loaded into memory.
