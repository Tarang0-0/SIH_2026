# Technology Stack — RailETA

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
