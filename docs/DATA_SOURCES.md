# RailETA — Train Data Sources & Provenance Specification
**Document ID:** `docs/DATA_SOURCES.md`  
**Problem Statement:** SIH 2026 — PS 26028 (Dynamic Forecast of ETA for Coaching Trains)  
**Last Updated:** 2026-08-27  

---

## 1. Data Integrity Principles & Constraints

To strictly uphold the **"Zero Fabricated Information & Zero LLM Hallucination"** constraint of SIH 26028:
1. **No Fake Claims:** Unofficial or simulated feeds must NEVER be described as official government APIs.
2. **Provenance Tagging:** Every data record throughout the entire pipeline (Database → API → UI) must carry an explicit `data_source` provenance tag:
   - `REAL`: Verifiable static timetable, station GIS, and official open datasets.
   - `DERIVED`: Numerically calculated features, cumulative distances, or scheduled run-times derived from real static timetables.
   - `SIMULATED`: Deterministic replay feeds and operational event streams used for live demonstration.
   - `SYNTHETIC`: Section running time data generated for ML training with strict statistical distributions and zero temporal leakage.
3. **No Scraping Against Terms:** We do not perform unauthorized web scraping of CRIS/NTES internal endpoints.

---

## 2. Comprehensive Data Source Inventory

### Source 1: Data.gov.in (National Open Data Portal — Ministry of Railways)
- **Reference / URL:** `https://data.gov.in/` (Ministry of Railways — All India Train Schedules & Stations)
- **Status:** Official Public Government Open Data (NDSAP License).
- **Type:** Static Timetable & Station Master.
- **Update Cadence:** Annual / Periodic Timetable Publications.
- **Fields Available:**
  - `Train No`, `Train Name`, `Station Code`, `Station Name`, `Arrival Time`, `Departure Time`, `Distance (km)`, `Source Station`, `Destination Station`.
- **Fields Missing:** Live GPS coordinates of running trains, real-time signal delays.
- **Reliability:** High (Official IR Timetable baseline).
- **Role in RailETA:** Primary system of record in Supabase for `trains`, `stations`, `routes`, and `route_stations`.

---

### Source 2: Open Railway Data & Public IR Schedule Catalog
- **Reference / URL:** Public Indian Railways GTFS / Open Data Repositories (`trains.csv`, `stations.csv`, `schedules.csv`)
- **Status:** Public Open Data (Open Database License).
- **Type:** Static Geocoded Route Topology.
- **Update Cadence:** Regularly updated with official timetable changes.
- **Fields Available:**
  - `station_code`, `station_name`, `latitude`, `longitude`, `zone`, `division`, `train_number`, `train_name`, `train_type`, `sequence_number`, `scheduled_arrival`, `scheduled_departure`.
- **Reliability:** High for timetable and spatial coordinates.
- **Role in RailETA:** Provides accurate PostGIS coordinates for vector map rendering and route distance calculations across major coaching corridors.

---

### Source 3: OpenStreetMap & OpenRailwayMap GIS Layer
- **Reference / URL:** `https://www.openrailwaymap.org/` / OpenStreetMap Vector Tile Service
- **Status:** Open Data (ODbL).
- **Type:** Spatial Track Geometry.
- **Fields Available:** Railway tracks, double-track alignments, electrified corridors, junction layouts.
- **Role in RailETA:** Provides underlying MapLibre GL vector tile dark basemap and track geometry rendering.

---

### Source 4: CRIS / NTES (National Train Enquiry System) Live Status
- **Reference / URL:** `https://enquiry.indianrail.gov.in/`
- **Status:** Official Passenger Enquiry System (Internal / Partner APIs).
- **Public API Status:** Official public REST API for free commercial consumption is **not available**. Third-party API resellers wrap unofficial scrapes which violate Terms of Service and introduce reliability risks.
- **Remediation Strategy for SIH 26028:**
  - Build an abstracted **`LiveProvider`** ready for official CRIS/IRCTC webhook integration when credentials are provided in production.
  - For Hackathon demonstration, use the **`ReplayProvider`**, streaming canonical running updates (`timestamp`, `latitude`, `longitude`, `speed_kmph`, `delay_minutes`, `current_station`, `next_station`) explicitly tagged as `SIMULATED`.

---

## 3. Data Provider Interface Architecture

All data ingestion across the platform is decoupled through an abstract provider pattern:

```text
                     +---------------------------+
                     |    TrainDataProvider      |
                     |  (Abstract Base Interface)|
                     +-------------+-------------+
                                   |
        +--------------------------+--------------------------+
        |                          |                          |
+-------v-------+          +-------v-------+          +-------v-------+
|  Historical   |          |    Replay     |          |  Live (CRIS/  |
|   Provider    |          |   Provider    |          | Webhook) Prov |
| (Timetable &  |          | (Deterministic|          | (Production   |
|   ML Data)    |          |  Sim Demo)    |          |  Integration) |
+-------+-------+          +-------+-------+          +-------+-------+
        |                          |                          |
        +--------------------------+--------------------------+
                                   |
                      +------------v------------+
                      | Canonical Train Schema  |
                      |   (Pydantic / SQL)      |
                      +------------+------------+
                                   |
                      +------------v------------+
                      |  Supabase System Record |
                      +-------------------------+
```

### Provider Contract Specification

```python
class BaseTrainDataProvider(ABC):
    @abstractmethod
    async def get_active_trains(self) -> List[TrainSummary]:
        """Fetch list of all active trains in the network."""
        pass

    @abstractmethod
    async def get_route_topology(self, train_number: str) -> RouteTopology:
        """Fetch station-by-station topology and scheduled timings."""
        pass

    @abstractmethod
    async def get_latest_running_state(self, journey_id: str) -> CanonicalTrainEvent:
        """Fetch current telemetry and observed delay."""
        pass

    @abstractmethod
    def get_data_source_mode(self) -> str:
        """Returns provenance tag: REAL, SIMULATED, or SYNTHETIC."""
        pass
```

---

## 4. Corridor Dataset Coverage in RailETA

For the SIH MVP and demonstration, the following major Indian Railways coaching corridors are fully seeded from official timetables:

| Train Number | Train Name | Type | Origin | Destination | Distance | Total Stations |
|:---|:---|:---|:---|:---|:---|:---:|
| **12004** | Lucknow Swarna Shatabdi Express | Shatabdi | NDLS (New Delhi) | LKO (Lucknow Charbagh) | 511.0 km | 5 |
| **12951** | Mumbai Rajdhani Express | Rajdhani | BCT (Mumbai Central) | NDLS (New Delhi) | 1386.0 km | 7 |
| **12301** | Howrah Rajdhani Express | Rajdhani | HWH (Howrah Junction) | NDLS (New Delhi) | 1451.0 km | 8 |
| **22436** | Vande Bharat Express | Vande Bharat | NDLS (New Delhi) | BSB (Varanasi Junction) | 759.0 km | 4 |
| **12424** | Dibrugarh Rajdhani Express | Rajdhani | NDLS (New Delhi) | DBRG (Dibrugarh) | 2442.0 km | 12 |

---

## 5. Summary & Compliance Statement

- All static timetables, station coordinates, and route sequences derive from verified public Indian Railways published data.
- Live running telemetry during evaluation runs through the deterministic replay feed and is prominently tagged `SIMULATED`.
- Zero fabricated records are passed off as real telemetry.
