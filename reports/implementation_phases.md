# RailTrackr model improvement phases

## Phase 1 — Data foundation and observability

Status: implemented.

- Persist every normalized live observation in SQLite.
- Persist the forecast rows generated from that observation.
- Store provider payload, timestamp quality, provider name, and model version.
- Resolve a forecast only when a later observation reports the station.
- Export only terminal observations as completed-journey labels.
- Keep tests and synthetic providers isolated from production feedback data.
- Expose `/api/v1/trains/{train_number}/history` for audit and UI display.

## Phase 2 — Station-level training dataset

Status: pipeline and gated trainer implemented; activation remains data-gated
until verified live station-arrival labels span the required dates.

- Build timestamped snapshots for current station, next station, and route
  segment.
- Create labels for minutes-to-next-station and delay-at-next-station.
- Require a real station-arrival event or a clearly marked provider observation
  bound before a row can become a label.
- Add a separate chronological holdout for unseen dates and unseen routes.

Implemented in this phase:

- Normalize IndianRailAPI `TrainRoute` records and retain actual versus expected
  times separately.
- Persist station events and cancelled/rescheduled operational events in the
  feedback SQLite store.
- Refresh a live train's route from the official `TrainSchedule` API when an
  IndianRailAPI key is configured, with a bounded in-memory cache and local
  fallback on provider failure.
- Export `data/station_level_training.csv` only from provider-reported actual
  arrival pairs through `scripts/build_station_level_dataset.py`.
- Provide `scripts/13_train_next_station_models.py`, which refuses to train
  until at least 50 verified labels across three dates are available.
- Provide `scripts/15_collect_live_feedback.py` for bounded provider polling;
  each poll records the live observation and route events without turning a
  prediction or expected time into a label.
- Load Phase 2 quantile artifacts when their feature contract is valid and use
  them as the next-station serving fallback when Phase 3 artifacts are absent.

Current local gate: 103 verified rows across 1 journey date are available;
the trainer requires at least 50 rows across 3 dates, so Phase 2 serving is
not active.

## Phase 3 — Live movement features and next-station model

Status: movement dataset, serving/training contracts, and honest data gate
implemented; activation is waiting for verified snapshot-to-arrival labels.

- Add current delay, delay trend, dwell time, speed, GPS-derived distance,
  remaining scheduled time, station sequence, train identity, and segment ID.
- Train separate P50/P10/P90 next-station travel-time and delay-propagation
  models.
- Compare against carry-forward and timetable baselines.

Implemented in this phase:

- Build movement snapshots from live observations with delay, delay trend,
  dwell/speed availability, segment distance, remaining timetable, station
  sequence, train identity hash, and segment identity hash.
- Create labels only from a later provider-confirmed next-station arrival.
- Train separate travel-time and delay-change P10/P50/P90 artifacts through
  `scripts/14_train_phase3_movement_models.py` after a minimum data gate.
- Compare travel-time predictions with the timetable baseline and delay-change
  predictions with a zero-change carry-forward baseline.
- Load a Phase 3 artifact only when every quantile model and its feature
  contract are valid; otherwise keep the existing safe ETA interpolation.
- Run the complete gated export/training sequence with
  `scripts/19_run_phase_pipeline.py`.

Current local gate: no verified Phase 3 movement rows are available. The
pipeline exits non-zero when either trainer is gated so automation cannot
mistake a data gate for a successful model build.

## Phase 4 — Operational and external signals

- Status: weather and live-station derived signals implemented; an optional
  authorised network-signal adapter is available, but provider-only block
  occupancy and maintenance signals remain unavailable until configured.
- OpenWeather current conditions are fetched from live train coordinates (or an
  explicitly tagged station-coordinate fallback), cached briefly, exposed in
  live ETA/SSE responses, and stored in `weather_observations`.
- Phase 3 exports now carry provider-backed weather columns as optional Phase 4
  features. Missing weather remains missing and is marked with
  `weather_available=0`; it is not filled with a training median.
- Add headway, block occupancy, station congestion, maintenance blocks,
  preceding-train delay, cancellations, and diversions.
- Backfill missing features only with explicitly tagged estimates; do not hide
  missing live signals behind training medians.

## Phase 5 — Calibration, drift, and safe promotion

Status: implemented as an offline calibration/audit/promotion control plane.

- `scripts/16_calibrate_model.py` creates a chronological conformal calibration
  artifact and preserves a later untouched holdout.
- Serving widens only interval bounds; it never changes the median forecast.
- `scripts/17_phase5_audit.py` reports provider freshness, delay drift, weather
  and station-board coverage, and resolved error by segment.
- `scripts/18_promote_model.py` requires enough rows, an untouched holdout,
  lower P50 MAE, and target interval coverage before updating the model registry.
- Retraining remains explicitly gated by the Phase 2/3 verified-label minimums;
  no model is promoted from predictions or expected times.
