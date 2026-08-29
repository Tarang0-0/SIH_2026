# RailETA — Complete UI/UX & Information Architecture Audit

**Document ID:** `docs/UX_AUDIT.md`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26028  
**Title:** Dynamic Forecast of Expected Time of Arrival (ETA) for Coaching Trains  
**Date:** 2026-08-28  

---

## 1. Executive Summary

This document presents a comprehensive, 20-dimension user experience and information architecture audit of the RailETA system prior to overhaul. While the underlying backend, Supabase database, and cascading GBDT ML forecasting engines are technically robust, the initial user interface presented significant usability barriers for first-time passengers and operators alike.

---

## 2. Comprehensive 20-Dimension Audit

| # | Dimension | Initial State Finding | Severity | Remediated Strategy |
|:---|:---|:---|:---:|:---|
| 1 | **Time to Comprehension** | First-time users took > 30 seconds to decipher technical jargon (e.g. "TreeExplainer Attribution", "Residual Quantile Bounds"). | **High** | Rebuilt for **5–10 second comprehension**: Big bold Expected Arrival Time, Delay Status, and Next Station visible immediately. |
| 2 | **Information Hierarchy** | Important metrics (Next Station ETA, Destination Arrival) were buried beneath dense tables and raw feature bars. | **High** | Enforced strict **7-Level Hierarchy**: Level 1 (Expected Arrival) $\to$ Level 2 (Delay Status) $\to$ Level 3 (Next Station) $\to$ Level 4 (Destination ETA) $\to$ Level 5 (Freshness) $\to$ Level 6 (Confidence Window) $\to$ Level 7 (Plain-Language Explanation). |
| 3 | **Screen Density & Overload** | Single monolithic screen attempting to show fleet search, route timeline, GBDT table, SHAP charts, and simulation controls at once. | **High** | Introduced **Dedicated Views**: Overview / Home, Find Train, Live Map, and Operations Dashboard. |
| 4 | **Passenger vs Operations Split** | Ordinary passengers looking for train arrival times were forced to view complex machine learning telemetry. | **High** | Created explicit **Dual Modes**: Simple, readable Passenger Mode vs deep, high-density Operations Mode. |
| 5 | **Homepage Orientation** | Homepage opened directly into a dense control-room dashboard rather than guiding the user to search. | **Medium** | Built a welcoming **Overview Homepage** with a prominent search hero, network snapshot, and popular trains grid. |
| 6 | **Search Usability** | Search was confined to a small header input without keyboard navigation or empty state guidance. | **Medium** | Upgraded to **Full Autocomplete Search**: debounced queries, arrow key navigation, rich train cards, and recent lookups. |
| 7 | **Deep Linking & Sharing** | Refreshing the page lost the selected train; URLs could not be shared. | **Medium** | Implemented **URL Deep Linking** (`/trains/[id]` and `?train=12004`) for bookmarkable train states. |
| 8 | **Scheduled vs Expected Clarity** | Users could not easily compare scheduled timetable arrival against dynamic predicted arrival. | **Medium** | Provided direct visual comparison: `Scheduled 18:30` vs `Expected 18:41 (+11 min)`. |
| 9 | **Prediction History** | Users could not see how or why the prediction changed over time as the train progressed. | **Medium** | Added **Prediction History Stream** (`18:20 → 18:38`, `18:25 → 18:40`) demonstrating live adaptation. |
| 10 | **"Why did ETA change?"** | Explanations were either technical SHAP key dumps or missing entirely. | **Medium** | Built **Human-Friendly Explanations** mapping SHAP attributions into plain English ("Entry delay +5m", "Fog caution speed +3m"). |
| 11 | **Data Freshness Indicators** | Timestamp was hidden in small footer text without clear staleness warnings. | **Medium** | Prominent **Freshness Badge**: `Updated 24 seconds ago` / `⚠ Stale` if $> 30$ min. |
| 12 | **Data Provenance Transparency** | Fake "Live" labels were used during simulation/replay. | **High** | Explicit **Provenance Badges**: `● LIVE DATA`, `● DEMO REPLAY (SIMULATED)`, `● HISTORICAL`. |
| 13 | **Button Intent & Labels** | Generic buttons like "Apply" and "Submit" did not communicate side-effects. | **Medium** | Action-oriented button labels: `Search Train`, `View Train`, `+10m Signal Caution`, `Reset Replay`. |
| 14 | **Microinteractions & Feedback** | When live WebSockets arrived, numbers changed abruptly without visual context. | **Low** | Added subtle **Update Toasts** (`ETA updated: 18:41 → 18:48`) and smooth node transitions. |
| 15 | **Loading States** | Generic "Loading..." text caused layout shift. | **Low** | Context-specific **Skeleton Loaders** for ETA cards, route progress, and tables. |
| 16 | **Empty States** | Blank screens when search had no results. | **Low** | Helpful **Empty States** with actionable suggestions and popular train links. |
| 17 | **Error Handling** | Raw API error codes shown on network failures. | **Low** | User-friendly **Error Alerts** with retry actions (`Couldn't load train data · [Retry]`). |
| 18 | **Accessibility (a11y)** | Color was the only indicator of delay; focus rings were missing. | **Medium** | High-contrast tokens, text + icons for status, visible focus rings, ARIA landmarks. |
| 19 | **Mobile Responsiveness** | Horizontal table scroll and overlapping cards on mobile devices. | **High** | Mobile-first vertical stack ordering (Train $\to$ Expected Arrival $\to$ Delay $\to$ Next Station $\to$ Destination). |
| 20 | **Hardcoded Data** | Static fallback train arrays and hardcoded KPI statistics. | **High** | Replaced with dynamic database/catalog queries via `BaseTrainDataProvider`. |

---

## 3. Conclusion & Redesign Mandate

The redesign focuses on **instant clarity, cognitive relief, progressive disclosure, and absolute data integrity**. Passengers get immediate answers to "When will my train arrive?", while operators retain full access to deep telemetry, MapLibre GL tracking, SHAP explainability, and What-If simulation.
