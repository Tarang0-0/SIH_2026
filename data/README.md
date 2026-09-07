# Data sources and live-data contract

`train_routes_index.json` is the local timetable index used by the application.
It is not a live-tracking feed.

`station_coordinates.json` is a coordinate catalogue for known stations. Missing
coordinates intentionally remain missing: the map must not interpolate fake
station positions or imply that a straight line is a railway track geometry.

## Official status integration

The backend supports the documented IndianRailAPI live-status and live-station
endpoints. Configure the provider key below; the key is never committed to the
repository or returned by the API. IndianRailAPI supplies station and delay
status, but not GPS coordinates or speed, so those fields remain unavailable.

```text
INDIAN_RAIL_API_KEY=your-indianrailapi-key
INDIAN_RAIL_API_BASE_URL=https://indianrailapi.com/api/v2
```

The resulting endpoints are:

```text
GET /api/v1/trains/{train_number}/live-eta?date=YYYY-MM-DD
GET /api/v1/trains/{train_number}/live-stream?date=YYYY-MM-DD
GET /api/v1/stations/{station_code}/live?hours=2
GET /api/v1/trains/{train_number}/history?date=YYYY-MM-DD
```

`live-eta` fetches the current station and delay, then passes them into the
deployed ETA model. `live-stream` sends that same model forecast in each SSE
event. The `hours` value accepted by IndianRailAPI is 2 or 4.

If IndianRailAPI is not configured, the older generic authorised-provider
adapter remains available:

To enable live telemetry, configure an authorised HTTPS provider:

```text
OFFICIAL_RAIL_STATUS_URL=https://approved-provider.example/status
OFFICIAL_RAIL_STATUS_TOKEN=optional-bearer-token
OFFICIAL_RAIL_STATUS_POLL_SECONDS=30
OFFICIAL_RAIL_STATUS_MAX_AGE_SECONDS=300
```

The provider receives `train_number` and, when supplied by the client,
`journey_date` as query parameters. It must return this JSON shape:

```json
{
  "train_number": "12627",
  "observed_at": "2026-09-07T10:15:00+05:30",
  "current_station": "BNC",
  "current_delay_minutes": 12,
  "latitude": 12.9901,
  "longitude": 77.5951,
  "speed_kmh": 45.0,
  "next_station": "YNK",
  "provider": "AUTHORISED_CRIS_FEED"
}
```

All coordinates and speed values are optional, but latitude and longitude must
be supplied together. The API rejects malformed, stale-format, mismatched-train,
and out-of-range provider values instead of displaying them as live data.

## Feedback and continuous learning

Successful live polls are stored in `data/railpulse_feedback.sqlite3`, which
is ignored by Git. Each forecast is linked to its train, journey date, station,
and provider. When a later provider observation reports that station, the
backend records the observed delay and forecast error. The observation time is
an arrival detection time, not an exact railway timestamp, because
IndianRailAPI does not provide GPS or a station-arrival event timestamp.

Only terminal observations are exported as completed-journey labels:

```text
./ml/venv/bin/python scripts/export_feedback_history.py
./ml/venv/bin/python scripts/12_train_ir_production.py
```

Retraining remains an explicit offline operation. This prevents the model from
learning from its own predictions or from incomplete journeys.
