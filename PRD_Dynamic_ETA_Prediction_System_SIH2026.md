# Product Requirements Document (PRD)
## Namaste Rail — Real-Time Dynamic ETA Prediction System for Indian Railways
**Smart India Hackathon 2026**

| | |
|---|---|
| **Document Owner** | Team [Your Team Name] |
| **Problem Statement Category** | Software — Transportation & Logistics |
| **Ministry/Organization** | Ministry of Railways / Indian Railways (CRIS) |
| **Version** | 1.0 |
| **Status** | Draft for SIH Submission |

---

## 1. Executive Summary

Namaste Rail is a real-time, machine-learning-driven ETA (Expected Time of Arrival) prediction platform for Indian Railways coaching trains. It replaces static, schedule-based ETA logic with a continuously-learning system that ingests live GPS location data, signalling information, weather, congestion, and historical running patterns to predict arrival times at every upcoming station — with a self-reported **confidence score** and a **plain-language delay reason**.

The platform serves four consumer surfaces from one prediction core:
1. **Public Website / Web App** (the primary SIH deliverable) — train search, live map, favorites & notifications, station amenities finder.
2. **REST/WebSocket APIs** — for mobile apps, station display boards (PDCs), and control room dashboards.
3. **Control Room Dashboard** — for railway operations staff (delay-cause drilldown, section congestion heatmaps).
4. **Notification Engine** — SMS/push/email alerts for favorited trains.

The core innovation is not just "predict a number" — it's a **transparent, self-critiquing, continuously-updating forecasting engine** that tells the user *why* it thinks what it thinks, and *how sure* it is.

---

## 2. Problem Statement (Recap)

Indian Railways currently estimates ETA using static schedules + current delay + fixed recovery margins. This ignores real-time ground realities: speed restrictions, congestion, unscheduled halts, preceding-train delays, weather, and historical section-level behavior — leading to poor passenger experience and inefficient station/crew/logistics planning, especially compounding over multi-day journeys.

---

## 3. Goals & Success Metrics

| Goal | KPI / Success Metric | Target (Prototype/SIH Demo) |
|---|---|---|
| Improve ETA accuracy over baseline (schedule + recovery) | Mean Absolute Error (MAE) in minutes at each predicted station | ≥ 30–40% reduction vs. baseline on historical replay |
| Real-time responsiveness | Time from new GPS/event ping to updated ETA pushed to client | < 5 seconds (backend), map refresh ≤ 2 min |
| Scalability | Concurrent trains tracked | Design for 13,000+ trains/day; demo with 50–100 simulated trains |
| Transparency & trust | % of predictions with confidence score + delay reason attached | 100% |
| User engagement | Favorite-train notification delivery success rate | ≥ 98% within 60s of trigger event |
| Usability | Landing page time-to-first-search | < 3 seconds page load, 1-click search |
| Adoption readiness | API uptime (SLA target for control rooms) | 99.9% |

---

## 4. Target Users / Personas

1. **Priya, the Daily Commuter/Traveler (Passenger)** — Wants to know "when will my train actually reach my station" and "should I leave for the station now." Uses mobile/web on the go.
2. **Ramesh, the Station Staff / Platform Manager** — Needs accurate ETAs to plan platform allocation, cleaning crews, catering, and announcements.
3. **Sunita, the Control Room / Section Controller** — Needs section-level congestion visibility, delay-cause breakdown, and cascading-impact forecasts across multiple trains.
4. **Feeder Logistics Operator (Cab aggregators, cargo, courier partners)** — Needs API access to plan pickups/deliveries timed to real arrivals.
5. **Vikram, the Family Member Waiting to Receive a Passenger** — Wants a simple favorite + notification experience without needing to constantly refresh an app.

---

## 5. Scope

### 5.1 In Scope (SIH Prototype)
- Train search by number/name/route.
- Live map with train position, updated every ≤ 2 minutes.
- ML-based dynamic ETA prediction at all upcoming stops.
- Confidence score + human-readable delay-reason explanation per prediction.
- Favorites + real-time notification system (station-approaching alerts).
- Nearby amenities finder (food stalls, waiting rooms, restrooms, water, medical) at a given station, for early-arrived passengers.
- Public REST + WebSocket API layer.
- Control room dashboard (basic version) for delay-cause analytics.
- Historical delay-pattern analytics per train/route/section.
- Fully responsive, animated, minimalistic landing page.

### 5.2 Out of Scope (Future Roadmap)
- Real integration with CRIS/NTES production data feeds (prototype uses simulated/historical open data + mock live feed).
- Ticketing, booking, or PNR functions.
- Freight/goods train tracking (coaching trains only, per problem statement).
- Full crew-scheduling automation (only ETA feed provided to hypothetical crew system via API).

---

## 6. Feature List (Complete)

### 6.1 Core ETA Prediction Engine
| # | Feature | Description |
|---|---|---|
| F1 | Dynamic ETA Computation | Predicts ETA at every remaining station on the route, recalculated continuously. |
| F2 | Multi-Signal Data Fusion | Combines GPS/location pings, signal aspect data, sectional running time (SRT) tables, weather, historical delay data, congestion index, preceding-train status. |
| F3 | Confidence Score | Every prediction is tagged with a 0–100% confidence value derived from model variance / prediction interval width. |
| F4 | Self-Rated Explainability ("Why this delay?") | Model outputs top contributing factor(s) — e.g., "68% likely due to congestion at Kanpur Central; 22% due to late running of preceding Shatabdi." Uses feature-attribution (e.g., SHAP-style) on the underlying model. |
| F5 | Continuous Online Learning | Model retrains/updates incrementally as actual arrival times are logged, improving accuracy over time (feedback loop). |
| F6 | Cascading Delay Propagation | For multi-day/long-distance trains, models how a delay at station A propagates to stations B, C, D with uncertainty growing appropriately. |
| F7 | Multi-Train, Multi-Zone Scalability | Stateless prediction microservice architecture designed to horizontally scale to thousands of trains across all 17 railway zones. |
| F8 | Anomaly/Unscheduled-Stop Detection | Flags and re-forecasts immediately when a train halts outside scheduled stops (e.g., signal failure, unscheduled maintenance block). |

### 6.2 Passenger-Facing Website Features
| # | Feature | Description |
|---|---|---|
| F9 | Train Search | Search by train number, name, source/destination station, or route. Autosuggest as you type. |
| F10 | Live Train Map | Interactive map (India rail network) showing live train position, refreshed every ≤ 2 minutes, with route polyline, next-station ETA, and current speed. |
| F11 | Station-Wise ETA Table | For a searched train: full stop list with scheduled time, predicted ETA, delay (±min), confidence %, and delay reason per station. |
| F12 | **Favorites & Smart Notifications** | User can star/favorite a train + their boarding/alighting station. System sends push/SMS/email/in-app notification when the train is a configurable X minutes away from that station (default 15/30/60 min, user-adjustable). |
| F13 | **Nearby Amenities Finder** | If a passenger has arrived early, the app shows nearby food stalls, waiting rooms, restrooms, drinking water points, medical rooms, cloakrooms, and ATMs at that station, with walking directions on the station map. |
| F14 | Platform Prediction | Predicted platform number (where data available) shown alongside ETA. |
| F15 | Delay History / Punctuality Score | Historical on-time performance chart for the searched train (last 30/90 days). |
| F16 | Multi-language Support | Hindi, English, and regional language toggle (extensible i18n framework). |
| F17 | Accessibility Mode | High-contrast mode, screen-reader friendly, large-text mode for elderly/differently-abled users. |
| F18 | Journey Planner / "Where should I be at what time" | For passengers yet to leave home, calculates recommended departure time to reach the station based on live ETA + buffer. |
| F19 | Share / Track-with-Family | Generate a shareable live-tracking link so family can watch a train's progress without needing the app. |
| F20 | Offline-friendly PWA | Progressive Web App with cached last-known data for low-connectivity zones (common on Indian trains). |
| F21 | Voice Search (stretch) | Voice-based train number search for accessibility. |
| F22 | Crowdsourced Feedback | "Was this ETA accurate?" quick thumbs-up/down after journey, feeding back into model evaluation. |

### 6.3 Staff / Control Room Features
| # | Feature | Description |
|---|---|---|
| F23 | Control Room Dashboard | Zone/division-wise live map, delay heatmap, top delay causes, trains-at-risk list. |
| F24 | Section Congestion View | Visualizes congestion index on busy sections in real time to support traffic decisions. |
| F25 | Cascading Impact Alerts | Flags when a delay is likely to cascade to connecting trains/crew schedules. |
| F26 | Platform & Resource Planning Feed | API feed for platform allocation, cleaning crew, and catering dispatch systems, driven by predicted arrival windows. |
| F27 | Model Performance Monitor (Admin) | Internal dashboard showing live MAE, confidence calibration, and drift metrics for the ML model — supports the "AI rates itself" requirement at a system level. |

### 6.4 API & Integration Layer
| # | Feature | Description |
|---|---|---|
| F28 | Public REST API | `GET /trains/{train_no}/eta`, `/trains/{train_no}/live`, `/stations/{code}/amenities`, etc. |
| F29 | WebSocket Live Feed | Real-time push channel for map position + ETA updates (no polling needed on client). |
| F30 | Webhook Subscriptions | Third parties (feeder transport, logistics) can subscribe to ETA-crossing-threshold events. |
| F31 | API Rate Limiting & Auth | API key-based access, tiered rate limits (public vs. partner vs. internal). |
| F32 | Data Export | CSV/JSON export of historical punctuality data for research/analytics use. |

---

## 7. Landing Page Design Specification

**Design Philosophy:** Minimalistic, aesthetic, confidence-inspiring — "the calm control tower of Indian Railways." Inspired by the clean data-forward feel of railradar.in, but warmer and more passenger-friendly, with the search bar as the undisputed hero element.

### 7.1 Hero Section
- **Background:** A subtle, looping SVG/Lottie animation of a **Vande Bharat train** silhouette gliding left-to-right across a minimal horizon line (low-opacity, muted color — e.g., soft Indian Railways navy/saffron gradient), so it never competes with foreground text. Parallax effect on scroll for depth. Should degrade gracefully to a static hero image on low-power devices (`prefers-reduced-motion` respected).
- **Headline:** Short, confident tagline — e.g., *"Know exactly when your train arrives."*
- **Search Bar (center-stage, large, rounded):**
  - Single input: train number OR train name OR station name (auto-detects intent).
  - Live autosuggest dropdown (train number + name + running days) as user types.
  - Recent searches (local) and Trending/Popular trains shown when input is empty.
  - Prominent CTA button: "Track Train".
- **Secondary quick actions below search bar:**
  - "PNR-free Live Status" toggle
  - "Search by Station" tab (see what's arriving/departing at a station)
  - "My Favorites" quick-access icon (star) — shows count badge if notifications pending.

### 7.2 Below-the-Fold Sections (minimal, card-based, generous white space)
1. **Live Network Snapshot** — small stat strip: trains tracked live, average network punctuality today, zones covered.
2. **How It Works** — 3-step visual: Search → Live Predict → Get Notified.
3. **Why Namaste Rail** — 3 feature cards: "AI-Powered ETA," "Explainable Delays," "Real-Time Map (2-min refresh)."
4. **Live Map Teaser** — mini embedded India map with a few live-moving train dots, "Explore Full Map" CTA.
5. **Trust/Transparency strip** — "Every prediction comes with a confidence score" with a sample mini-widget.
6. **Footer** — API docs link, About, Zones covered, Contact, language switch, dark/light mode toggle.

### 7.3 Visual & Interaction Guidelines
- **Color palette:** Indian Railways-inspired but modern — deep navy/indigo primary, saffron/amber accent for alerts & CTAs, soft off-white background, muted greens for "on-time," ambers for "minor delay," reds for "major delay" (colorblind-safe palette, never color-only — always paired with icon/text).
- **Typography:** Clean geometric sans-serif (e.g., Inter/Poppins-style), strong hierarchy, generous line-height.
- **Motion:** Micro-interactions only — subtle fade/slide on card entry, animated train icon moving along route lines, no jarring transitions.
- **Dark mode:** Full support, especially important for late-night station use.
- **Mobile-first:** Search bar and live ETA table must be flawless on small screens (majority of Indian Railways users are mobile-first).

---

## 8. System Architecture (High Level)

```
                         ┌───────────────────────────┐
                         │   Data Ingestion Layer     │
   GPS/Location Feeds ─▶ │ (Kafka / MQTT Ingestion)   │
   Signal & TSR Data  ─▶ │  - stream normalization    │
   Weather API        ─▶ │  - schema validation       │
   Historical DB      ─▶ └─────────────┬──────────────┘
                                        │
                                        ▼
                         ┌───────────────────────────┐
                         │  Feature Store / Stream    │
                         │  Processing (Spark/Flink)  │
                         └─────────────┬──────────────┘
                                        │
                                        ▼
                         ┌───────────────────────────┐
                         │   ML Prediction Service     │
                         │  - ETA regression models    │
                         │  - delay-cause classifier    │
                         │  - confidence estimator      │
                         │  - online learning/feedback   │
                         └─────────────┬──────────────┘
                                        │
                                        ▼
                         ┌───────────────────────────┐
                         │   API Gateway (REST/WS)     │
                         └───────┬─────────┬──────────┘
                                 │         │
                     ┌───────────┘         └───────────┐
                     ▼                                 ▼
          ┌────────────────────┐            ┌────────────────────┐
          │  Web App / PWA      │            │ Control Room /       │
          │  (React/Next.js)    │            │ Partner Dashboards   │
          └─────────┬───────────┘            └────────────────────┘
                     │
                     ▼
          ┌────────────────────┐
          │ Notification Engine │
          │ (Push/SMS/Email via │
          │  FCM/Twilio/SES)    │
          └────────────────────┘
```

### 8.1 Recommended Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React / Next.js, Tailwind CSS, Mapbox GL / Leaflet for maps, Framer Motion for animation |
| Backend API | Node.js (NestJS) or Python (FastAPI) |
| Streaming/Ingestion | Apache Kafka, MQTT (for GPS device feeds) |
| Stream Processing | Apache Flink / Spark Structured Streaming |
| ML Framework | Python — scikit-learn / XGBoost / LightGBM for tabular ETA regression; LSTM/Temporal Fusion Transformer for sequence-based sectional prediction; SHAP for explainability |
| Feature Store | Feast (open-source feature store) |
| Databases | PostgreSQL + PostGIS (geospatial), TimescaleDB (time-series GPS pings), Redis (cache/live state) |
| Notification | Firebase Cloud Messaging (push), Twilio/MSG91 (SMS), AWS SES (email) |
| Infra | Docker + Kubernetes, deployable on NIC Cloud / AWS / Azure for govt readiness |
| Monitoring | Prometheus + Grafana (system), custom MLOps dashboard (model drift/MAE) |
| Auth | OAuth2 / JWT, API key management for partner tier |

---

## 9. Data Sources (Prototype vs. Production)

| Data Type | Prototype (SIH Demo) | Production (Real Deployment) |
|---|---|---|
| Live train location | Simulated GPS replay from historical/open running data, or public live-status scraping/partner feed | Indian Railways RTIS/GPS feed, CRIS NTES integration |
| Schedule & SRT | Open data (data.gov.in train schedules) | Integrated Coaching Management System (ICMS) |
| Weather | OpenWeatherMap API | IMD real-time feed |
| Historical delay patterns | Public historical punctuality datasets | CRIS historical running data warehouse |
| Congestion/signal | Simulated congestion index from headway data | Signalling system (interlocking) feed, TMS |
| Station amenities | Manually curated/OSM (OpenStreetMap) POI data per station | IRCTC/Indian Railways facility database |

---

## 10. Machine Learning Approach

### 10.1 Prediction Pipeline
1. **Base ETA:** Scheduled arrival + cumulative running-time model per section (learned, not static).
2. **Dynamic Adjustment Model:** Gradient-boosted regression (XGBoost/LightGBM) using features: current delay, distance to next station, historical section delay distribution, weather severity index, congestion index, day-of-week/time-of-day, preceding-train status, TSR (temporary speed restriction) flags.
3. **Sequence Model (for long-haul journeys):** Temporal Fusion Transformer or LSTM to capture multi-station dependency and cascading effects across a multi-day journey.
4. **Confidence Estimation:** Quantile regression (predicting P10/P50/P90 ETA) — width of interval converted into a displayed confidence %.
5. **Delay-Reason Classifier:** A secondary classification model (or SHAP feature attribution on the regression model) outputs the top 1–2 contributing factors in natural language, e.g., *"Predicted 18-min delay — primary factor: congestion near [Section], secondary: late-running of preceding train."*
6. **Feedback Loop:** Actual arrival time logged post-event → error computed → used for periodic (e.g., nightly) model retraining and live calibration monitoring.

### 10.2 Model Evaluation Metrics
- MAE / RMSE (minutes) per station-distance-bucket (near-term vs. far-term predictions).
- Calibration curve (do 90%-confidence predictions actually land within interval 90% of the time?).
- Delay-reason classifier accuracy vs. logged actual causes (where available).

---

## 11. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Scalability | Must support 13,000+ daily trains, horizontally scalable microservices, stateless prediction workers behind load balancer. |
| Performance | API p95 latency < 300ms; map refresh cycle ≤ 2 minutes; WebSocket push < 5s from event to client. |
| Availability | 99.9% uptime target for public API; graceful degradation to last-known-good ETA if a data source is temporarily unavailable. |
| Security | HTTPS everywhere, JWT/OAuth2 auth, API key rate limiting, input sanitization, no PII stored beyond what's needed for notifications (opt-in, deletable). |
| Data Privacy | Favorite/notification data tied to anonymous device ID or optional login; compliant with India's DPDP Act 2023 principles. |
| Accessibility | WCAG 2.1 AA compliance target. |
| Localization | English + Hindi at minimum for SIH demo; extensible i18n. |
| Auditability | All predictions logged with input feature snapshot for explainability/audit trail. |

---

## 12. Key User Flows

### 12.1 Passenger Tracks a Train
1. Land on homepage → type train number in hero search bar.
2. Autosuggest confirms train → click "Track Train."
3. Train detail page: live map (updates ≤2 min), full station ETA table with confidence % and delay reason per stop.
4. User taps ⭐ to favorite + selects their station + notification lead time.
5. As train approaches, push/SMS notification sent.

### 12.2 Passenger Arrives Early
1. Opens train tracking page → sees "You're early, train arrives in 47 min."
2. Taps "Find nearby facilities" → station map shows food stalls, waiting room, restrooms, water points with walking distance.

### 12.3 Control Room Staff Monitors Section
1. Logs into dashboard → sees zone map with color-coded delay heatmap.
2. Drills into a specific train/section → sees model's delay-reason breakdown and cascading-risk flags for downstream trains.

---

## 13. Wireframe Outline (for design/dev reference)

1. **Landing Page** — Hero w/ animated Vande Bharat, search bar, quick stats, feature cards, mini live map.
2. **Search Results Page** — List of matching trains with quick live-status chips.
3. **Train Detail Page** — Live map, station-wise ETA table, punctuality history chart, favorite button, share button.
4. **Station Page** — Trains arriving/departing at a station, amenities map.
5. **Favorites Page** — List of favorited trains, notification settings per train.
6. **Control Room Dashboard** — Zone map, heatmap, alerts feed, model performance widget.
7. **API Docs Page** — Interactive API explorer (Swagger/OpenAPI).

---

## 14. Roadmap / Milestones

| Phase | Timeline (Illustrative for SIH) | Deliverables |
|---|---|---|
| Phase 1 — Foundation | Week 1–2 | Data pipeline (simulated feed), baseline ETA model, DB schema, basic API |
| Phase 2 — Core ML | Week 3–4 | Dynamic ETA model + confidence scoring + delay-reason explainability |
| Phase 3 — Web App | Week 5–6 | Landing page, search, live map, train detail page |
| Phase 4 — Bonus Features | Week 7 | Favorites + notifications, amenities finder, dashboard |
| Phase 5 — Polish & Demo | Week 8 | Performance tuning, UI polish, demo dataset, pitch deck, video |

---

## 15. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| No access to real live GPS/CRIS data during hackathon | Build realistic simulator using open historical datasets + replay engine |
| Model overfits to simulated data | Use cross-validation across routes/zones; report honest metrics; design for real-feed plug-in later |
| Notification delivery delays | Use reliable managed services (FCM/Twilio) with retry/queueing |
| Scalability claims not demoable live | Provide architecture-level load-test simulation results + design docs, demo with representative subset |
| Map refresh performance at scale | Use WebSocket diffs instead of full re-fetch; client-side interpolation between 2-min updates for smooth motion |

---

## 16. Team Roles (Suggested for SIH Team of 6)

| Role | Responsibility |
|---|---|
| ML Engineer(s) | ETA model, confidence scoring, explainability, retraining pipeline |
| Backend Engineer | APIs, data ingestion, streaming, notification engine |
| Frontend Engineer(s) | Landing page, live map, train detail UI, dashboard |
| UI/UX Designer | Design system, animation, accessibility |
| Data/Domain Lead | Sourcing & cleaning open railway datasets, domain accuracy checks |
| Presenter/PM | Pitch deck, demo flow, documentation, PRD ownership |

---

## 17. Competitive Reference

RailRadar.in and NTES (National Train Enquiry System) currently provide live running status primarily based on last-reported delay + static recovery margins, with a clean map-based UI. **Namaste Rail differentiates by:**
- Genuinely predictive (not just "current delay carried forward") ML modeling.
- Transparent confidence scores and human-readable delay reasoning (neither competitor currently exposes *why* a delay is predicted).
- Proactive, favorite-based notification system tied to the user's specific boarding/alighting station.
- Integrated station-amenities layer for the "arrived early" use case.
- Open API-first design for control room and third-party logistics integration.

---

## 18. Glossary

- **ETA** — Expected Time of Arrival
- **SRT** — Sectional Running Time
- **TSR** — Temporary Speed Restriction
- **NTES** — National Train Enquiry System
- **CRIS** — Centre for Railway Information Systems
- **PDC** — Passenger Display/Coach board at stations
- **MAE** — Mean Absolute Error
- **PWA** — Progressive Web App

---

## 19. Appendix — Sample API Contract

```
GET /api/v1/trains/{train_number}/eta
Response 200:
{
  "train_number": "22691",
  "train_name": "Rajdhani Express",
  "last_updated": "2026-08-31T10:42:00+05:30",
  "current_location": { "lat": 28.61, "lon": 77.21, "section": "NDLS-GZB" },
  "stations": [
    {
      "station_code": "GZB",
      "scheduled_arrival": "10:55",
      "predicted_arrival": "11:08",
      "delay_minutes": 13,
      "confidence_percent": 87,
      "delay_reason": "Moderate congestion on NDLS-GZB section; preceding train running 9 min late.",
      "platform_prediction": 3
    }
  ]
}
```

```
POST /api/v1/favorites
{
  "user_id": "anon-8f2c...",
  "train_number": "22691",
  "notify_station": "GZB",
  "notify_lead_minutes": 30
}
```

---

*End of Document — Ready for SIH 2026 submission formatting (PPT/idea presentation to follow separately if required).*
