<!-- GSD:project-start source:PROJECT.md -->

## Project

**RailETA — Dynamic Forecast of ETA for Coaching Trains**

RailETA is a continuously updating, explainable Expected Time of Arrival (ETA) forecasting engine for Indian Railways coaching trains. It combines real-time train running state, schedules, historical section-level running behavior, and operational/environmental variables to dynamically forecast future arrival times at upcoming stations and final destinations.

**Core Value:** Accurately forecast future section-level running behavior and arrival times dynamically as operational events occur, delivering measurable improvements over static schedule + delay baselines without using fabricated data or LLM hallucinations.

### Constraints

- **Tech Stack**: Next.js, FastAPI, Supabase PostgreSQL, XGBoost/LightGBM, MapLibre GL JS, Pytest, Playwright.
- **Data Integrity**: Zero data leakage constraint (predictions at time T use only data available at or before T).
- **No Fabricated Information**: Explicit labeling of REAL vs SIMULATED data; empirical ML evaluation.
- **System of Record**: Supabase PostgreSQL as sole database platform (no MongoDB/Firebase).

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Core Tech Stack

| Component | Technology | Rationale | Alternatives Considered |
|-----------|------------|-----------|-------------------------|
| **Frontend Framework** | Next.js (React 19 / App Router) | Server-side rendering, fast initial load, seamless layout streaming, TypeScript support | Vite/SPA (lacks SSR/SEO optimization) |
| **Styling & Components** | Tailwind CSS + shadcn/ui | Modern, responsive, accessible, UI design consistency, design token integration | Plain CSS, Material UI (heavier runtime footprint) |
| **Map Rendering** | MapLibre GL JS | Open-source, provider-agnostic vector mapping, smooth station/train marker animations | Google Maps JS API (proprietary API key cost/restrictions), Leaflet (raster tile performance limits) |
| **State & Data Fetching** | TanStack Query (React Query) | Cache management, optimistic UI updates, polling/refetching control | Redux / Zustand alone (more boilerplate for server state) |
| **Backend Framework** | FastAPI (Python 3.11+) | Async endpoint handling, high performance, automatic Pydantic OpenAPI docs, seamless ML model integration | Django/Flask (slower, less async-native) |
| **Database Platform** | Supabase (Managed PostgreSQL 15+ & PostGIS) | Full-featured PostgreSQL, PostGIS spatial queries, Row Level Security (RLS), Supabase Realtime | MongoDB/Firebase (lacks tabular/relational integrity required for route schedules) |
| **ML & Data Processing** | Python, Pandas, NumPy, scikit-learn, XGBoost / LightGBM, SHAP | Dominant tabular time-series performance, fast training/inference, native feature contribution explainability | LSTM/PyTorch/TensorFlow (overfitting on small datasets, high latency, black box) |
| **Testing & Verification** | Pytest, Vitest, Playwright | End-to-end browser automation, unit testing, deterministic ML pipeline verification | Cypress (Playwright provides multi-browser speed and python integration) |

## Development & AI Workflow Stack

- **GSD Core**: Project planning, milestone tracking, requirement decomposition, verification gates.
- **Google Antigravity**: Primary AI implementation engine for coding, debugging, refactoring, and execution.
- **Google Stitch**: Frontend UI/UX exploration, wireframes, and design component references.

## Key Recommendations & Version Bounds

- Python: `^3.11`
- Next.js: `^14.2` or `^15.0`
- FastAPI: `^0.110.0`
- XGBoost: `^2.0.0`
- MapLibre GL: `^4.0.0`
- Supabase Client: `^2.40.0`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
