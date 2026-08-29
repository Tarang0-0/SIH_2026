# RailETA — SIH 2026 Jury Demonstration Script (< 90 Seconds)
**Document ID:** `docs/DEMO.md`  
**Problem Statement:** SIH 2026 — PS 26028 (Dynamic Forecast of ETA for Coaching Trains)  

---

## 90-Second Demonstration Script

### Step 1: Open Website & Search Train (0 - 15s)
1. Open `http://localhost:3000`.
2. Notice the clean, passenger-first interface with active data mode badge (**`DEMO REPLAY`** / **`SIMULATED`**).
3. Search for train **`12004`** ("Lucknow Swarna Shatabdi Express").

### Step 2: Passenger View & Core Dynamic ETA (15 - 35s)
1. Point to the **Dynamic Expected Arrival**:
   - Next Station: **ALJN (Aligarh Jn)** at **07:59 AM** (Predicted delay: +8 min).
   - Destination: **LKO (Lucknow Charbagh)** at **12:48 PM** (Confidence window: [12:44 - 12:52 PM]).
2. Explain the schedule baseline comparison (+62.6% MAE improvement over static schedule + delay formula).

### Step 3: Switch to Operations Mode (35 - 55s)
1. Click **"Operations Mode"** in the top navigation.
2. Observe the interactive **MapLibre GL Vector Telemetry Tracking** with live track alignment and pulsing train position marker.
3. Observe the **SHAP TreeExplainer Feature Attribution** decomposing operational factors (entry speed, section distance, peak departure hour) into delay recovery vs compounding vectors.

### Step 4: Live Event Injection & Dynamic Recalculation (55 - 75s)
1. In the **What-If Disruption Simulator**, click **"+10m Signal Caution"**.
2. Immediately observe the live WebSocket broadcast updating the UI:
   - Observed Delay shifts from **+8m → +18m**.
   - Downstream station ETAs dynamically recalculate in real time.
   - Confidence bounds expand realistically without page reload.

### Step 5: Verification & Zero Data Leakage (75 - 90s)
1. Highlight the **Data Provenance & Zero Leakage Invariant** badge.
2. Conclude: RailETA delivers measurable, explainable, and physically sound dynamic arrival forecasts for Indian Railways coaching trains.
