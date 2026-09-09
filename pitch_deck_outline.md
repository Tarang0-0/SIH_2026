# Namaste Rail — SIH 2026 Pitch Deck & Presentation Guide
### Problem Statement: Dynamic Train ETA Prediction & Delay Propagation System
**Ministry of Railways / CRIS** | Smart India Hackathon 2026

---

## 🎯 The 5-Minute Elevator Pitch Script

### Slide 1: Title & Vision
* **Headline:** Namaste Rail — The Intelligent Operating System for Indian Railway ETAs
* **Presenter Dialogue:**  
  *"Respected Jury, Indian Railways runs over 13,000 passenger trains daily. Yet in 2026, when a train is 40 minutes late, the existing NTES simply adds 40 minutes to every future stop. It assumes delays stay flat. In reality, delays compound dynamically as trains enter congested bottlenecks. Namaste Rail replaces static timetable math with an intelligent, continuously learning ML telemetry engine."*

---

### Slide 2: The Core Problem — Why Existing Systems Fail
* **The "Flat Delay" Fallacy:** Carrying forward delay linearly fails because a 20-minute delay at Mathura can turn into a 60-minute delay at Kota if the train misses its signalling slot and gets held behind freight rakes.
* **The Passenger Blindspot:** Passengers arrive at stations with zero visibility into *why* their train is delayed, leading to overcrowded platforms and missed connecting trains.
* **The Solution:** A dynamic system providing:
  1. Compounding delay prediction (P10/P50/P90 quantile intervals)
  2. Natural language root-cause explainability (SHAP XAI)
  3. Proactive alerts and early-arrival station amenities

---

### Slide 3: Machine Learning Rigor & Leakage Eradication (Crucial for Judges)
* **Strict Temporal Integrity:**  
  - Trained on chronological splits (Months 1–4 Train, Month 5 Validation, Month 6 Test).
  - 15 complete train journeys held out as a zero-overlap unseen test set (`test_unseen_trains.parquet`).
  - Historical momentum computed strictly via `.expanding().mean().shift(1)` — zero peeking into the future.
* **Ablation Study Transparency:**  
  - We proved the model's accuracy is driven by organic autoregressive momentum (56.5% SHAP importance), NOT circular synthetic features.

---

### Slide 4: Quantile Uncertainty & The Monotonic Guard
* **The Problem:** Standard pinball loss quantile models suffer from "quantile crossing" ($P10 > P90$), which falsely reports narrow intervals on chaotic rows.
* **The Namaste Rail Solution:** We implemented an algorithmic monotonic guard (`np.sort`) that guarantees:
  $$P10 \le P50 \le P90 \quad \text{for 100\% of predictions}$$
* **Confidence Metric:** Inverse prediction interval width converted to an intuitive 0–100% Certainty Score ($100 \times e^{-0.02 \times \text{width}}$), achieving ~80% empirical calibration across test sets.

---

### Slide 5: Explainable AI (SHAP Waterfall Attribution)
* **From Black Box to Passenger Clarity:**  
  Instead of presenting an opaque "+24m" number, Namaste Rail's TreeExplainer breaks down exact feature contributions:
  - *Previous Stop Delay:* `+16 mins`
  - *Preceding Freight Traffic:* `+5.2 mins`
  - *Fog / Speed Restriction:* `+3.1 mins`
  - *Priority Track Clearance:* `-2.3 mins`
* **Human Output:** *"Predicted 24-min delay — primary factor: heavy freight traffic ahead on Mathura-Kota chord with speed restriction over Chambal bridge."*

---

### Slide 6: Continuous Learning Feedback Loop
* **Static Models Decay Over Time:** Rail dynamics shift with seasonal fog, track renewals, and revised timetables.
* **The Feedback Pipeline:** Newly completed journeys from Month 6 are automatically appended to the model warehouse and retrained.
* **Empirical Validation:** Retraining on new operational data **lowers MAE on completely unseen holdout trains by 1.87 minutes** (Demonstrated on reports slide: `reports/retraining_improvement.png`).

---

### Slide 7: Live Demonstration (Switch to Screen)
1. **Interactive Operations Dashboard (`/dashboard`):** Show the Bento Grid layout, live RTIS speed (122 km/h), cascading stations table, and SHAP delay waterfall.
2. **Full-Screen Live Map (`/map`):** Show the train physically moving along the Western Railway corridor, with toggles for Congestion Heatmaps and Signal Blocks.
3. **Station Amenities Modal:** Demonstrate how delayed passengers at Kota Junction can view IRCTC Lounge occupancy and luggage locker availability.
4. **Proactive Alerts:** Trigger an automated SMS dispatch simulation for a passenger waiting at Kota Junction.

---

### Slide 8: Architecture & Scalability
* **Backend:** FastAPI with in-memory model caching (14ms inference latency) and Server-Sent Events (SSE) live streaming.
* **Frontend:** Next.js React with Tailwind CSS, completely decoupled and ready to accept any custom Figma design.
* **Containerization:** Single-command deployment via Docker Compose (`docker compose up`).

---

### Slide 9: Impact on Indian Railways
* **Platform Decongestion:** Reduces unnecessary waiting time at stations by an estimated 25%.
* **Passenger Trust:** Eliminates surprise delays with plain-English reasons and confidence ratings.
* **Controller Efficiency:** Highlights downstream cascading bottlenecks before trains reach congested junctions.

---

*Thank you! Open for Questions & Technical Inspection.*
