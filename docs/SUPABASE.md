# RailETA — Supabase PostgreSQL Database Architecture & Operations
**Document ID:** `docs/SUPABASE.md`  
**Problem Statement:** SIH 2026 — PS 26028  

---

## 1. Database Architecture

RailETA utilizes **Supabase (Managed PostgreSQL 15+ & PostGIS)** as the single source of truth for all structured railway entities:
- Stations, Coordinates, Zones, Divisions (`stations`)
- Train Master & Categories (`trains`)
- Ordered Route Topology & Timetables (`routes`, `route_stations`)
- Active Journeys & Live Running States (`journeys`)
- Telemetry Event Logs (`running_updates`)
- Historical Section Run Metrics (`section_history`)
- Forecast History & SHAP Attributions (`eta_predictions`)

---

## 2. Spatial Querying with PostGIS

PostGIS extension enables high-performance spatial lookups:
- Distance calculation along track geometries (`ST_Distance`, `ST_LineLocatePoint`).
- Station proximity lookups (`ST_DWithin`).
- Snapping GPS coordinates to canonical rail track alignments.

---

## 3. Row-Level Security (RLS) Configuration

- Public read access (`SELECT`) is allowed for authenticated and anonymous users across timetable and forecast tables.
- Mutation access (`INSERT`, `UPDATE`, `DELETE`) is strictly restricted to `service_role` and verified ingestion workers to prevent unauthorized client tampering.
