# ETA model validation

Artifact: `models/model_metadata.json` (`time-safe-eta-v2-all-compatible-data`)

The saved production artifacts were retrained from every compatible supervised
journey available in `data/`: the 1,500,000-row legacy training file plus
1,860,954 journey-level rows derived from the 39 combined delay feeds. The
combined feeds contain 38,428,703 raw observations; 35,725,370 have a valid
date, train, station, and delay in the accepted 0–720 minute range. Multiple
station observations for the same train and date are reduced to the latest
station observation so journeys with more station records do not receive
extra weight.

The split is chronological by complete departure date, with no random mixing:

- Train: through 2024-05-24 (1,370,869 rows)
- Validation: 2024-05-25 through 2025-04-20 (486,115 rows)
- Strict latest holdout: 2025-04-21 through 2026-02-07 (1,503,970 rows)

The deployable models are refit on the train and validation periods after
early-stopping rounds are selected. The metrics below are measured on the
strict latest holdout using those saved deployable artifacts.

| Held-out metric | Result |
| --- | ---: |
| MAE | 33.85 min |
| RMSE | 66.82 min |
| Median-only baseline MAE | 92.94 min |
| P10–P90 coverage | 72.73% |

The model substantially improves on the median-only baseline, but the interval
coverage is below the nominal 80% target. P10/P90 uncertainty should therefore
be treated as useful guidance, not a calibrated guarantee; further calibration
would require more consistently aligned live station, weather, and network
features.

## Integrity safeguards

- `delay_minutes`, `is_delayed`, and `primary_delay_cause` are never model features.
- `current_delay` is not trained from the target. At serving time it anchors the present station and is propagated only through remaining stops.
- The API filters completed-run history to dates strictly before the queried journey date.
- The station-feed domain is marked with `is_station_feed`, and the backend sets that feature when a current station is supplied.
- P10/P90 are clamped around the independently predicted P50; P50 itself is not reordered as a side effect of fixing a crossed interval.

## Data boundary

`data/ir_test.csv` remains an independent test/holdout file and is not mixed
into training. Route catalogs, station coordinates, schedules, and alert
registries are lookup/configuration data rather than compatible supervised delay
rows; they are used by the API and feature builder where applicable. Invalid
or out-of-range combined-feed delays are rejected instead of being fabricated
or silently converted.

The live-status adapter uses the configured RailRadar provider in the local
environment, with IndianRailAPI retained as a fallback. Live responses are
validated at the API boundary, but live movement features are not promoted into
the production model until the Phase 2/3 label gates pass.

## Follow-up model audit

The current production feature contract is suitable for a route-level delay
baseline, but it is not yet a true live movement model:

- `current_delay` is excluded from the trained features and is only used at
  serving time to anchor/interpolate the downstream forecast.
- `current_station` is used to select the remaining route, but station/segment
  identity is not learned as a model feature.
- The combined feeds do not contain observation timestamps, speed, GPS, weather,
  dwell time, headway, or the actual next-station arrival timestamp.
- Several network and rolling-stock features are filled with training medians
  for the combined feed, so they cannot explain live variation.
- The current p50 model assigns approximately 85% of its tree importance to
  `is_station_feed`, indicating that it is learning the source/domain shift
  more strongly than train movement dynamics.
- The combined-feed target is a latest/highest-station observation proxy. It is
  not guaranteed to be a verified terminal-arrival label.

The next model version should be trained from station-level snapshots with an
as-of timestamp and two explicit targets: minutes to the next station and
delay at the next station. The current live delay is safe to use when it is
recorded before the future target event. Completed observations should be
joined to forecasts only after the provider reports the station; model
predictions must never become training labels.

## Phase 2 implementation status

The backend now normalizes the official `TrainRoute` response into station
events and separates provider-reported actual arrival/departure times from
expected times. These events are persisted in the feedback store. The export
script creates `data/station_level_training.csv` only from adjacent stations
with provider-actual arrival timestamps. A separate trainer is available, but
it intentionally refuses to create Phase 2 artifacts until at least 50 verified
labels across three dates are available. The latest local export contains 103
verified Phase 2 rows across one journey date and no verified Phase 3 movement
rows, so the Phase 2 and Phase 3 models remain inactive by design.
