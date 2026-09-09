# Contributing to Namaste Rail

Namaste Rail uses a single root repository containing the FastAPI backend, the
Next.js frontend, model artifacts, and supporting scripts.

## First-time setup

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>.git
cd SIH_202

python3 -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ml/requirements.txt

cp .env.example .env
cd frontend
npm ci
cp .env.example .env.local
cd ..
```

Provider keys are optional for the offline demo. Never commit `.env`,
`frontend/.env.local`, API keys, or other credentials.

Windows teammates can run the equivalent setup automatically with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
```

Then start both services with:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_demo.ps1
```

## Daily workflow

Before starting work, sync your local `main` branch:

```bash
git switch main
git pull --ff-only origin main
```

Create a short-lived branch for each change:

```bash
git switch -c feature/short-description
```

Run the relevant checks before committing:

```bash
# Backend
source .venv/bin/activate
python -m unittest discover -s tests -p 'test_*.py'

# Frontend
cd frontend
npm run lint
npm run build
cd ..
```

Start both services locally with:

```bash
./run_demo.sh
```

Commit focused changes with a descriptive message, push the branch, and open
a pull request against `main`:

```bash
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```

## Pull request expectations

- Explain what changed and how to test it.
- Keep secrets, local databases, virtual environments, `node_modules`, and
  build output out of commits.
- Update the relevant README or API/data documentation when behavior changes.
- Do not retrain or replace model artifacts without recording the data source,
  evaluation results, and model metadata.
- Ask at least one teammate to review before merging.

## Working with large training data

The raw training files under `data/` are intentionally ignored because some
are larger than GitHub's 100 MB per-file limit. Obtain them through the team's
approved shared storage and place them in the paths expected by the training
scripts. The API/demo does not require those raw files because the deployable
model artifacts are checked in under `models/`.

## Main branch protection

On GitHub, protect `main` and require pull-request review plus the CI checks
before merging. Teammates should merge through pull requests rather than
force-pushing or rewriting shared history.
