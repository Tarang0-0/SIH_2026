# RailETA — UX & Information Architecture Specification

**Document ID:** `docs/UX_SPEC.md`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26028  
**Title:** Dynamic Forecast of Expected Time of Arrival (ETA) for Coaching Trains  
**Date:** 2026-08-28  

---

## 1. Core Operating Principle & Primary Goal

> **"A first-time user must understand the application within 5–10 seconds."**

A passenger looking at RailETA must be able to answer 5 fundamental questions immediately:
1. **Where is my train?** $\to$ Current station & location.
2. **When will it arrive?** $\to$ Expected arrival time (ETA) at the upcoming station.
3. **How late is it?** $\to$ Delay status badge (`+8 min Late` or `On Time`).
4. **When was this updated?** $\to$ Freshness indicator (`Updated 24s ago`).
5. **Why did the ETA change?** $\to$ Plain-language explanation of operational factors.

---

## 2. 7-Level Information Hierarchy

Information is structured in strict order of importance:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ LEVEL 1: EXPECTED ARRIVAL TIME (Largest element, high-contrast)        │
│          e.g. 18:41                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 2: DELAY STATUS BADGE                                            │
│          e.g. [RUNNING 11 MIN LATE] (Scheduled: 18:30)                 │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 3: NEXT STATION DETAILS                                          │
│          e.g. Agra Cantt (AGC) · 48 km remaining                       │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 4: DESTINATION ETA & TOTAL JOURNEY OUTCOME                       │
│          e.g. New Delhi (NDLS) · Expected 23:14 (Scheduled: 23:02)     │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 5: DATA FRESHNESS & PROVENANCE                                   │
│          e.g. Updated 24s ago · [● DEMO REPLAY]                        │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 6: PREDICTION CONFIDENCE WINDOW                                  │
│          e.g. Likely Range: 18:36 — 18:48 (96.9% historical accuracy)  │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 7: PLAIN-LANGUAGE EXPLANATION ("Why did the ETA change?")        │
│          Expandable accordion with plain-English operational factors.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dual-Mode Experience

To prevent cognitive overload, the application is bifurcated into two distinct modes:

### Mode A: Passenger Mode
- **Target Audience:** Commuters, passengers, family members waiting at stations.
- **Key Characteristics:** Minimalist, highly readable, low technical density.
- **Visible Components:**
  - Hero Dynamic ETA Card (Levels 1–6).
  - Visual Route Progression Stepper (Passed, Active, Upcoming halts).
  - Scheduled vs Expected comparison timeline.
  - Prediction history summary.
  - "Why did the ETA change?" accordion (Level 7).

### Mode B: Operations Mode
- **Target Audience:** Section controllers, station masters, railway analysts.
- **Key Characteristics:** High-density telemetry, multi-train monitoring, what-if simulations.
- **Visible Components:**
  - Fleet Attention Sidebar (filter by on-time, minor delay, severe delay > 15m).
  - MapLibre GL Vector Tracking Map with track geometry and pulse markers.
  - Station-by-Station Cascading GBDT tabular predictions with confidence intervals.
  - SHAP TreeExplainer diverging feature contribution vectors.
  - Interactive What-If Disruption Simulator with live recalculation.

---

## 4. Multi-Screen Navigation Architecture

```text
RailETA App Shell
│
├── 1. Overview (Home)
│   ├── Search Hero (Prominent autocomplete input)
│   ├── Network Telemetry Snapshot (Fleet count, delay stats, ML accuracy)
│   └── Popular Verified Trains Grid (Shatabdi, Rajdhani, Vande Bharat)
│
├── 2. Find Train / Train Detail
│   ├── Search & Filter Catalog
│   ├── Passenger Hero ETA Card (7-tier hierarchy)
│   ├── Visual Route Stepper
│   ├── Scheduled vs Expected Station Schedule
│   └── Prediction History Stream
│
├── 3. Live Map
│   ├── MapLibre GL Full-Screen Vector Map
│   ├── Route Track Line & Glowing Corridor
│   └── Live Pulsing Train Markers with Status Popups
│
└── 4. Operations Dashboard
    ├── Fleet Sidebar & Attention Matrix
    ├── Cascading GBDT Forecasting Engine
    ├── SHAP TreeExplainer Model Attribution
    └── Interactive What-If Disruption Simulator
```

---

## 5. Data Presentation Classification

| Classification | Visibility Level | Examples |
|:---|:---|:---|
| **Primary** | Immediate, top-level display | Expected arrival time, delay minutes, train name, next station. |
| **Secondary** | Main page, supporting emphasis | Destination ETA, scheduled arrival, confidence window, freshness timestamp. |
| **Advanced** | Expandable on demand or in Operations Mode | SHAP feature impact vectors, distance in km, dwell minutes, speed. |
| **Internal** | Never exposed to passengers | Internal database IDs, raw model weights, raw feature tensors. |
