'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import { apiUrl } from '../../lib/api';

interface StationRecord {
  code: string;
  name: string;
  sched: string;
  pred: string;
  delay: number;
  conf: number;
  status: string;
  plat: string | null;
  reason: string;
  lat: number | null;
  lon: number | null;
}

type MappableStation = StationRecord & { lat: number; lon: number };

interface EtaStationPayload {
  station_code: string;
  station_name?: string | null;
  scheduled_arrival: string;
  predicted_arrival: string;
  delay_minutes: number;
  confidence_percent: number;
  delay_reason: string;
  platform_prediction?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface EtaPayload {
  train_number: string;
  train_name: string;
  origin_station?: string | null;
  destination_station?: string | null;
  current_location?: CurrentLocation;
  stations?: EtaStationPayload[];
}

interface NextStationPrediction {
  station_code: string;
  station_name?: string | null;
  scheduled_arrival: string;
  predicted_arrival: string;
  predicted_arrival_datetime?: string | null;
  scheduled_minutes_to_next: number;
  predicted_minutes_to_next: number;
  predicted_delay_minutes: number;
  p10_delay_minutes?: number | null;
  p90_delay_minutes?: number | null;
}

interface FeedbackComparison {
  station_code: string;
  predicted_delay_minutes: number;
  actual_delay_minutes: number;
  error_minutes: number;
}

interface CurrentLocation {
  journey_date?: string;
  station_code?: string;
  next_station_code?: string | null;
  route_progress_percent?: number;
  reported_delay_minutes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  speed_kmh?: number | null;
  position_available?: boolean;
  next_station_prediction?: NextStationPrediction | null;
  feedback?: {
    observation_recorded?: boolean;
    latest_comparison?: FeedbackComparison | null;
  };
}

interface RouteGeometry {
  type: 'LineString' | 'MultiLineString';
  coordinates: number[][] | number[][][];
  source?: string;
}

interface RouteGeometryResponse {
  train_number: string;
  route?: RouteGeometry;
}

interface StationAmenity {
  id: string;
  type: string;
  name: string;
  platform: string;
  status: string;
  occupancy: string;
  cost: string;
  amenities: string[];
}

interface StationAmenitiesResponse {
  station_code: string;
  station_name: string;
  recommendation: string;
  amenities: StationAmenity[];
}

interface HistoricalTimetableRow {
  station_code: string;
  station_name?: string | null;
  sequence?: number | null;
  scheduled_arrival?: string | null;
  scheduled_departure?: string | null;
  actual_arrival_at?: string | null;
  actual_departure_at?: string | null;
  delay_minutes?: number | null;
}

interface HistoricalTimetableDay {
  date: string;
  available: boolean;
  source: 'stored_station_events' | 'scheduled_route';
  observation_count: number;
  comparison_count: number;
  note: string;
  timetable: HistoricalTimetableRow[];
}

interface HistoricalTimetableResponse {
  train_number: string;
  train_name: string;
  days: HistoricalTimetableDay[];
}

interface LeafletMap {
  remove: () => void;
  fitBounds: (bounds: unknown, options?: { padding: [number, number] }) => void;
  setView: (center: [number, number], zoom: number) => void;
  panTo: (center: [number, number]) => void;
}

interface LeafletMarker {
  setLatLng: (position: [number, number]) => void;
  openPopup: () => void;
}

interface LeafletPolyline {
  getBounds: () => unknown;
}

interface LeafletApi {
  map: (container: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  control: { zoom: (options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void } };
  polyline: (points: [number, number][], options: Record<string, unknown>) => { addTo: (map: LeafletMap) => LeafletPolyline };
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (
    position: [number, number],
    options: Record<string, unknown>,
  ) => {
    addTo: (map: LeafletMap) => LeafletMarker & { bindPopup: (content: string) => LeafletMarker };
  };
}

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

const finiteNumber = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const delayLabel = (delay: number): string => delay > 0 ? `+${delay} min late` : 'On time';

const indiaDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trainFromQuery = searchParams.get('train') || '';
  const journeyDateFromQuery = searchParams.get('date') || indiaDate();

  const [inputTrainNo, setInputTrainNo] = useState(trainFromQuery);
  const journeyDate = journeyDateFromQuery;
  const [loading, setLoading] = useState(Boolean(trainFromQuery));
  const [errorMsg, setErrorMsg] = useState('');

  const [trainDetails, setTrainDetails] = useState({
    train_number: trainFromQuery,
    train_name: '',
    origin: 'Origin Station',
    dest: 'Destination Station',
  });

  const [stations, setStations] = useState<StationRecord[]>([]);
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null);
  const [stationAmenities, setStationAmenities] = useState<StationAmenitiesResponse | null>(null);
  const [amenitiesStatus, setAmenitiesStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historicalTimetable, setHistoricalTimetable] = useState<HistoricalTimetableResponse | null>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState('');

  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>({
    station_code: '',
    next_station_code: null as string | null,
    route_progress_percent: 0,
    reported_delay_minutes: null as number | null,
    next_station_prediction: null,
    feedback: undefined,
  });

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const trainMarkerRef = useRef<LeafletMarker | null>(null);
  const trackPolylineRef = useRef<LeafletPolyline | null>(null);
  const markersMapRef = useRef<Record<string, LeafletMarker>>({});
  const [leafletReady, setLeafletReady] = useState(false);

  // SSE telemetry
  const [liveGps, setLiveGps] = useState({
    speed: null as number | null,
    status: 'Live provider unavailable',
    lat: null as number | null,
    lon: null as number | null,
    positionAvailable: false,
  });

  const loadHistoricalTimetable = useCallback(async () => {
    const trainNo = trainDetails.train_number.trim();
    if (!trainNo || historyLoading || historicalTimetable) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/trains/${encodeURIComponent(trainNo)}/previous-timetables?days=5`));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Previous timetable data is unavailable.');
      const historyPayload = payload as HistoricalTimetableResponse;
      setHistoricalTimetable(historyPayload);
      setSelectedHistoryDate(historyPayload.days[0]?.date || '');
    } catch (error: unknown) {
      setHistoryError(error instanceof Error ? error.message : 'Previous timetable data is unavailable.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyLoading, historicalTimetable, trainDetails.train_number]);

  // Fetch live predictions and timetable
  const fetchLivePredictions = useCallback(async (trainNo: string, requestedDate = journeyDateFromQuery) => {
    const targetNo = trainNo.trim();
    if (!targetNo) {
      setLoading(false);
      return;
    }
    setInputTrainNo(targetNo);
    setHistoricalTimetable(null);
    setHistoryError('');
    setSelectedHistoryDate('');
    try {
      setLoading(true);
      setErrorMsg('');
      const dateParam = requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : '';
      // The selected journey date is explicit. When it is omitted, the backend
      // resolves overnight journeys from the timetable and current IST time.
      let res = await fetch(apiUrl(`/api/v1/trains/${encodeURIComponent(targetNo)}/live-eta${dateParam}`));
      if (!res.ok) {
        res = await fetch(apiUrl(`/api/v1/trains/${encodeURIComponent(targetNo)}/eta${dateParam}`));
      }
      
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Train ${targetNo} route not found in Indian Railways directory.`);
      }

      const data: EtaPayload = await res.json();

      if (data) {
        const etaStations = data.stations ?? [];
        const location = data.current_location ?? {};
        const firstStop = etaStations[0];
        const lastStop = etaStations[etaStations.length - 1];
        const originResolved = data.origin_station || firstStop?.station_name || 'Origin';
        const destResolved = data.destination_station || lastStop?.station_name || 'Destination';

        setTrainDetails({
          train_number: data.train_number,
          train_name: data.train_name,
          origin: originResolved,
          dest: destResolved,
        });

        setCurrentLocation({
          journey_date: location.journey_date,
          station_code: location.station_code || firstStop?.station_code || '',
          next_station_code: location.next_station_code || null,
          route_progress_percent: finiteNumber(location.route_progress_percent) ?? 0,
          reported_delay_minutes: finiteNumber(location.reported_delay_minutes),
          latitude: finiteNumber(location.latitude),
          longitude: finiteNumber(location.longitude),
          speed_kmh: finiteNumber(location.speed_kmh),
          position_available: Boolean(location.position_available),
          next_station_prediction: location.next_station_prediction || null,
          feedback: location.feedback,
        });

        setLiveGps((prev) => ({
          ...prev,
          speed: finiteNumber(location.speed_kmh),
          status: location.position_available ? 'Live GPS position available' : 'Live provider connected; GPS unavailable',
          lat: finiteNumber(location.latitude),
          lon: finiteNumber(location.longitude),
          positionAvailable: Boolean(location.position_available),
        }));

        if (etaStations.length > 0) {
          const mapped: StationRecord[] = etaStations.map((s, idx) => ({
            code: s.station_code,
            name: s.station_name || s.station_code,
            sched: s.scheduled_arrival,
            pred: s.predicted_arrival,
            delay: s.delay_minutes,
            conf: s.confidence_percent,
            status: idx === 0 ? 'Origin' : idx === etaStations.length - 1 ? 'Terminal' : 'Halt',
            plat: s.platform_prediction || null,
            reason: s.delay_reason,
            lat: typeof s.latitude === 'number' && Number.isFinite(s.latitude) ? s.latitude : null,
            lon: typeof s.longitude === 'number' && Number.isFinite(s.longitude) ? s.longitude : null,
          }));

          setStations(mapped);
          // The upcoming stop is the most useful default view after a search.
          setSelectedStationCode(mapped[1]?.code || mapped[0]?.code || null);
        } else {
          setStations([]);
        }
      }
    } catch (err: unknown) {
      console.error('Fetch live prediction error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to retrieve train telemetry. Verify train number.');
    } finally {
      setLoading(false);
    }
  }, [journeyDateFromQuery]);

  useEffect(() => {
    if (trainFromQuery) {
      const fetchTimer = window.setTimeout(() => {
        void fetchLivePredictions(trainFromQuery, journeyDateFromQuery);
      }, 0);
      return () => window.clearTimeout(fetchTimer);
    }
  }, [trainFromQuery, journeyDateFromQuery, fetchLivePredictions]);

  // Load provider-supplied railway geometry separately so a temporary
  // geometry-provider outage never prevents ETA data from rendering.
  useEffect(() => {
    const resetTimer = window.setTimeout(() => setRouteGeometry(null), 0);
    if (!trainFromQuery) {
      return () => window.clearTimeout(resetTimer);
    }
    const controller = new AbortController();
    void fetch(apiUrl(`/api/v1/trains/${encodeURIComponent(trainFromQuery)}/route-geometry`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<RouteGeometryResponse>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) setRouteGeometry(payload?.route || null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRouteGeometry(null);
      });
    return () => {
      window.clearTimeout(resetTimer);
      controller.abort();
    };
  }, [trainFromQuery]);

  const facilityStationCode = selectedStationCode || currentLocation.station_code || '';

  useEffect(() => {
    if (!facilityStationCode) return;
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      setAmenitiesStatus('loading');
      setStationAmenities(null);
      void fetch(apiUrl(`/api/v1/stations/${encodeURIComponent(facilityStationCode)}/amenities`), {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Verified station facility data is not available.');
          return response.json() as Promise<StationAmenitiesResponse>;
        })
        .then((payload) => {
          if (controller.signal.aborted) return;
          setStationAmenities(payload);
          setAmenitiesStatus('ready');
        })
        .catch(() => {
          if (!controller.signal.aborted) setAmenitiesStatus('unavailable');
        });
    }, 0);
    return () => {
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [facilityStationCode]);

  // Dynamically load Leaflet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) {
      const readyTimer = window.setTimeout(() => setLeafletReady(true), 0);
      return () => window.clearTimeout(readyTimer);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.body.appendChild(script);
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    const mappableStations = stations.filter(
      (s): s is MappableStation => s.lat !== null && s.lon !== null
    );

    if (!leafletReady || !mapContainerRef.current || mappableStations.length === 0) return;
    const L = window.L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [mappableStations[0].lat, mappableStations[0].lon],
      zoom: 6,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    // OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Keep the real railway network visible underneath the timetable corridor.
    // The selected route remains highlighted, while this layer prevents the
    // map from implying that a straight station-to-station line is the track.
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openrailwaymap.org" target="_blank" rel="noreferrer">OpenRailwayMap</a>',
      maxZoom: 19,
      opacity: 0.78,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Prefer provider-supplied track geometry. The timetable station path is
    // retained as a fallback for providers that do not expose GIS geometry.
    const latlngs = mappableStations.map((s) => [s.lat, s.lon] as [number, number]);
    const normalizeSegment = (segment: number[][]): [number, number][] => segment
      .map(([longitude, latitude]) => (
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [latitude, longitude] as [number, number]
          : null
      ))
      .filter((point): point is [number, number] => point !== null);
    const geometrySegments = routeGeometry
      ? routeGeometry.type === 'LineString'
        ? [normalizeSegment(routeGeometry.coordinates as number[][])]
        : (routeGeometry.coordinates as number[][][]).map(normalizeSegment)
      : [];
    const validGeometrySegments = geometrySegments.filter((segment) => segment.length > 1);
    const routePoints = validGeometrySegments.flat().length > 1 ? validGeometrySegments.flat() : latlngs;
    const hasProviderGeometry = validGeometrySegments.length > 0;

    if (hasProviderGeometry) {
      validGeometrySegments.forEach((segment) => {
        L.polyline(segment, {
          color: '#38bdf8',
          weight: 5,
          opacity: 0.95,
          lineJoin: 'round',
        }).addTo(map);
      });
    } else {
      L.polyline(latlngs, {
        color: '#38bdf8',
        weight: 5,
        opacity: 0.95,
        dashArray: '8 7',
        lineJoin: 'round',
      }).addTo(map);
    }
    // Keep one bounds object for the Fit Route button, regardless of whether
    // the provider returned one or several geometry segments.
    trackPolylineRef.current = L.polyline(routePoints, { opacity: 0, weight: 1 }).addTo(map);

    const currentMapIndex = mappableStations.findIndex((station) => station.code === currentLocation.station_code);
    const progress = Math.max(0, Math.min(100, currentLocation.route_progress_percent ?? 0));
    const providerPassedCount = Math.max(2, Math.round((progress / 100) * (routePoints.length - 1)) + 1);
    const passedPoints = hasProviderGeometry
      ? routePoints.slice(0, Math.min(providerPassedCount, routePoints.length))
      : currentMapIndex > 0 ? latlngs.slice(0, currentMapIndex + 1) : [];
    if (passedPoints.length > 1) {
      L.polyline(passedPoints, {
        color: '#34d399',
        weight: 7,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(map);
    }

    if (latlngs.length > 1) {
      map.fitBounds(trackPolylineRef.current.getBounds(), { padding: [50, 50] });
    } else {
      map.setView(latlngs[0], 9);
    }

    // Render Station Pins
    markersMapRef.current = {};
    mappableStations.forEach((stn, idx) => {
      const isPassed = currentMapIndex >= 0 ? idx < currentMapIndex : false;
      const isCurrent = idx === currentMapIndex;
      const isDelayed = stn.delay > 5;
      const pinClass = isCurrent ? 'station-pin current' : isPassed ? 'station-pin passed' : isDelayed ? 'station-pin delayed' : 'station-pin';

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `<div class="${pinClass}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 14px; margin-bottom: 2px;">
            ${escapeHtml(stn.code)} - ${escapeHtml(stn.name)}
          </div>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${escapeHtml(stn.plat || 'Platform not available')}</div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
            <span>Assigned time:</span>
            <strong style="color: #f8fafc;">${escapeHtml(stn.sched)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
            <span>Expected time:</span>
            <strong style="color: #38bdf8;">${escapeHtml(stn.pred)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);">
            <span>Delay:</span>
            <strong style="${stn.delay === 0 ? 'color: #34d399;' : 'color: #fbbf24;'}">
              ${escapeHtml(delayLabel(stn.delay))}
            </strong>
          </div>
        </div>
      `;

      const marker = L.marker([stn.lat, stn.lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      markersMapRef.current[stn.code] = marker;
    });

    // Train marker starts at live GPS when available, then falls back to the
    // reported station instead of guessing a fixed position on the route.
    const currentStation = mappableStations.find((station) => station.code === currentLocation.station_code);
    const initialTrainPos: [number, number] = currentLocation.latitude !== null && currentLocation.latitude !== undefined
      && currentLocation.longitude !== null && currentLocation.longitude !== undefined
      ? [currentLocation.latitude, currentLocation.longitude]
      : currentStation
        ? [currentStation.lat, currentStation.lon]
        : [mappableStations[0].lat, mappableStations[0].lon];

    const trainIcon = L.divIcon({
      className: 'train-icon-wrap',
      html: `<div class="train-live-marker" aria-label="Train location"><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 10h16M8 17l-2 3M16 17l2 3M8 7h.01M16 7h.01"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const trainPopupContent = currentStation ? `
      <div style="font-family: inherit; font-size: 13px; min-width: 190px;">
        <div style="font-weight: 700; color: #38bdf8; font-size: 14px; margin-bottom: 6px;">Train is here</div>
        <div style="font-weight: 700; color: #f8fafc; margin-bottom: 7px;">${escapeHtml(currentStation.code)} - ${escapeHtml(currentStation.name)}</div>
        <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;"><span>Assigned time:</span><strong style="color: #f8fafc;">${escapeHtml(currentStation.sched)}</strong></div>
        <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;"><span>Expected time:</span><strong style="color: #38bdf8;">${escapeHtml(currentStation.pred)}</strong></div>
        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.1);"><span>Delay:</span><strong style="color: ${currentStation.delay > 0 ? '#fbbf24' : '#34d399'};">${escapeHtml(delayLabel(currentStation.delay))}</strong></div>
      </div>
    ` : '<div style="font-family: inherit; font-size: 13px;"><strong>Train position</strong><br/>Station timing is not available yet.</div>';

    trainMarkerRef.current = L.marker(initialTrainPos, {
      icon: trainIcon,
      zIndexOffset: 1000,
    }).addTo(map).bindPopup(trainPopupContent);

  }, [leafletReady, stations, routeGeometry, currentLocation.station_code, currentLocation.latitude, currentLocation.longitude, currentLocation.route_progress_percent]);

  // Connect SSE real-time stream
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetNo = trainDetails.train_number;
    if (!targetNo) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(apiUrl(
        `/api/v1/trains/${encodeURIComponent(targetNo)}/live-stream?date=${encodeURIComponent(journeyDate)}`
      ));
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.gps) {
            const newLat = data.gps.latitude;
            const newLon = data.gps.longitude;
            setLiveGps({
              speed: Number.isFinite(data.gps.speed_kmh) ? data.gps.speed_kmh : null,
              status: data.gps.data_source || 'Live provider connected; GPS unavailable',
              lat: newLat,
              lon: newLon,
              positionAvailable: Boolean(Number.isFinite(newLat) && Number.isFinite(newLon)),
            });

            if (trainMarkerRef.current && Number.isFinite(newLat) && Number.isFinite(newLon)) {
              trainMarkerRef.current.setLatLng([newLat, newLon]);
            }
          }
        } catch {}
      };
      es.onerror = () => {
        setLiveGps((prev) => ({ ...prev, status: 'Live telemetry unavailable' }));
        es?.close();
      };
    } catch {}
    return () => {
      if (es) es.close();
    };
  }, [trainDetails.train_number, journeyDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTrainNo.trim()) {
      router.push(`/dashboard?train=${encodeURIComponent(inputTrainNo.trim())}&date=${encodeURIComponent(journeyDate)}`);
    }
  };

  const handleStationClick = (stn: StationRecord) => {
    setSelectedStationCode(stn.code);
    if (mapInstanceRef.current && stn.lat !== null && stn.lon !== null) {
      mapInstanceRef.current.panTo([stn.lat, stn.lon]);
      const marker = markersMapRef.current[stn.code];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const handleFitRoute = () => {
    if (mapInstanceRef.current && trackPolylineRef.current) {
      mapInstanceRef.current.fitBounds(trackPolylineRef.current.getBounds(), { padding: [50, 50] });
    }
  };

  const currentSelectedStation = stations.find((s) => s.code === selectedStationCode) || stations[0];
  const upcomingStation = currentLocation.next_station_prediction ?? (
    stations[1]
      ? {
          station_code: stations[1].code,
          station_name: stations[1].name,
          scheduled_arrival: stations[1].sched,
          predicted_arrival: stations[1].pred,
          predicted_minutes_to_next: null,
          predicted_delay_minutes: stations[1].delay,
        }
      : null
  );
  const currentStation = stations.find((station) => station.code === currentLocation.station_code) || stations[0];
  const currentStationLabel = currentStation
    ? `${currentStation.code} · ${currentStation.name}`
    : currentLocation.station_code || 'Current location unavailable';
  const facilityStation = stations.find((station) => station.code === facilityStationCode) || currentStation;
  const facilityStationName = facilityStation?.name || facilityStationCode || 'Selected station';
  const waitingAreaSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facilityStationName} railway station waiting room`)}`;
  const canteenSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facilityStationName} railway station canteen`)}`;

  const handleLocateTrain = () => {
    const hasGps = liveGps.positionAvailable && liveGps.lat !== null && liveGps.lon !== null;
    const target = hasGps
      ? [liveGps.lat as number, liveGps.lon as number] as [number, number]
      : currentStation?.lat !== null && currentStation?.lat !== undefined && currentStation?.lon !== null && currentStation?.lon !== undefined
        ? [currentStation.lat, currentStation.lon] as [number, number]
        : null;
    if (!target || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(target);
    if (hasGps) {
      trainMarkerRef.current?.openPopup();
    } else if (currentStation) {
      markersMapRef.current[currentStation.code]?.openPopup();
    }
  };
  const overallDelay = currentLocation.reported_delay_minutes ?? currentSelectedStation?.delay ?? 0;
  const isDelayed = overallDelay > 0;
  const delayReason = currentSelectedStation?.reason || 'Corridor operates within normal dispatch tolerance.';

  if (!trainFromQuery) {
    return (
      <div className="dashboard-light min-h-screen bg-[#eef7ff] text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow flex items-center justify-center px-6 py-16">
          <div className="panel-card max-w-lg p-8 text-center">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-3">Live operations</div>
            <h1 className="text-2xl font-bold text-white mb-3">Choose a train to begin</h1>
            <p className="text-sm text-slate-400 mb-6">Search the live train directory first, then choose a train to inspect its current location and next stop.</p>
            <Link href="/" className="inline-flex bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg">Open train search</Link>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-light min-h-screen bg-[#eef7ff] text-slate-900 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <div className="text-base font-bold font-mono text-white tracking-wide">Acquiring Live Transit Stream...</div>
          <div className="text-xs text-slate-400 font-mono mt-1">Train #{inputTrainNo} • RTIS Telemetry Gateway</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-light min-h-screen bg-[#eef7ff] text-slate-900 flex flex-col font-sans">
      <Navbar />

      {/* Operations Header Banner */}
      <section className="bg-[#0b2034] border-b border-sky-300/15 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Train Identity & Journey Bar */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                {trainDetails.train_number}
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-200">
                {trainDetails.train_name}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  isDelayed ? 'badge-delayed' : 'badge-ontime'
                }`}
              >
                {isDelayed ? `+${overallDelay} MIN DELAYED` : 'ON SCHEDULE'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Origin:</span>
                <span className="text-white font-semibold">{trainDetails.origin}</span>
                <span className="text-blue-400">({stations[0]?.sched || '--:--'})</span>
              </div>
              <span className="text-slate-600">➔</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Destination:</span>
                <span className="text-white font-semibold">{trainDetails.dest}</span>
                <span className="text-blue-400">({stations[stations.length - 1]?.sched || '--:--'})</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
                <span>{stations.length} Scheduled Halts</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
                <span>Journey {currentLocation.journey_date || '--'}</span>
              </div>
            </div>
          </div>

          {/* Train switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex items-center bg-white border border-sky-200 rounded-lg p-1 shadow-sm">
              <input
                type="text"
                value={inputTrainNo}
                onChange={(e) => setInputTrainNo(e.target.value)}
                placeholder="Train No..."
                className="w-24 sm:w-28 px-2.5 py-1 text-xs font-mono text-slate-800 bg-transparent outline-none placeholder-slate-400"
              />
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer shadow-sm"
              >
                Track
              </button>
            </form>
          </div>

        </div>
      </section>

      {upcomingStation && (
        <section className="px-4 sm:px-6 lg:px-8 pt-5">
          <div className="max-w-7xl mx-auto panel-card px-5 py-5 sm:px-6 border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent shadow-lg shadow-blue-950/20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-cyan-300 font-mono font-bold">
                  <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
                  Upcoming station
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-black text-white truncate">
                  {upcomingStation.station_name || upcomingStation.station_code}
                  <span className="ml-2 text-sm sm:text-base font-mono font-semibold text-cyan-300">({upcomingStation.station_code})</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Currently at <span className="font-semibold text-slate-200">{currentStationLabel}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-7">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Expected arrival</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-black font-mono text-white">{upcomingStation.predicted_arrival}</div>
                  {upcomingStation.predicted_minutes_to_next !== null && upcomingStation.predicted_minutes_to_next !== undefined && (
                    <div className="text-xs text-slate-400 font-mono">in about {upcomingStation.predicted_minutes_to_next} min</div>
                  )}
                </div>
                <div className="h-10 w-px bg-white/10 hidden sm:block" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Delay at this station</div>
                  <div className={`mt-1 text-2xl sm:text-3xl font-black font-mono ${upcomingStation.predicted_delay_minutes > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {upcomingStation.predicted_delay_minutes > 0 ? `+${upcomingStation.predicted_delay_minutes} min` : 'On time'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">Scheduled {upcomingStation.scheduled_arrival}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-400">
              <span>Forecast confidence: <strong className="text-white">{stations[1]?.conf ?? '—'}%</strong></span>
              <span>Route progress: <strong className="text-white">{Math.round(currentLocation.route_progress_percent ?? 0)}%</strong></span>
              {currentLocation.feedback?.latest_comparison && (
                <span>Latest observed error: <strong className="text-emerald-300">{currentLocation.feedback.latest_comparison.error_minutes > 0 ? '+' : ''}{currentLocation.feedback.latest_comparison.error_minutes} min</strong></span>
              )}
            </div>
          </div>
        </section>
      )}

      {facilityStation && (
        <section className="px-4 sm:px-6 lg:px-8 pt-5">
          <div className="max-w-7xl mx-auto panel-card border border-emerald-400/20 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300 font-mono font-bold">Passenger facilities</div>
                <h2 className="mt-1 text-lg font-bold text-white">Nearby at {facilityStationName} <span className="text-sm font-mono text-slate-400">({facilityStation.code})</span></h2>
                <p className="mt-1 text-xs text-slate-400">Find a waiting area or food option while you wait for the train.</p>
              </div>
              {amenitiesStatus === 'loading' && <span className="text-xs font-mono text-slate-500">Checking facility feed…</span>}
            </div>

            {amenitiesStatus === 'ready' && stationAmenities?.amenities.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stationAmenities.amenities.map((amenity) => (
                  <div key={amenity.id} className="rounded-xl border border-white/[0.08] bg-[#0a0f1d] p-4">
                    <div className="flex items-start justify-between gap-3"><div className="font-semibold text-white">{amenity.name}</div><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-mono text-emerald-300">{amenity.status}</span></div>
                    <div className="mt-2 text-xs text-slate-400">{amenity.type} · {amenity.platform || 'Station concourse'}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">{amenity.occupancy && <span>{amenity.occupancy}</span>}{amenity.cost && <span>{amenity.cost}</span>}{amenity.amenities.map((item) => <span key={item} className="text-cyan-300">{item}</span>)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a href={waitingAreaSearchUrl} target="_blank" rel="noreferrer" className="group rounded-xl border border-white/[0.08] bg-[#0a0f1d] p-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.05]">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4v16M19 4v16M5 5h14M5 12h14M7 20h-3M20 20h-3"/><path d="M8 12v8M16 12v8"/></svg></span><div><div className="text-sm font-bold text-white">Waiting area</div><div className="mt-1 text-xs text-slate-500">Find the nearest mapped option</div></div></div><span className="text-cyan-300 transition group-hover:translate-x-1">↗</span></div>
                </a>
                <a href={canteenSearchUrl} target="_blank" rel="noreferrer" className="group rounded-xl border border-white/[0.08] bg-[#0a0f1d] p-4 transition hover:border-amber-400/40 hover:bg-amber-400/[0.05]">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/10 text-amber-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10h12a1 1 0 0 1 1 1c0 3-2.5 5-7 5s-7-2-7-5a1 1 0 0 1 1-1Z"/><path d="M8 18h8M9 20h6M12 7v3M9 7c0-2 1.5-3 3-3s3 1 3 3"/></svg></span><div><div className="text-sm font-bold text-white">Canteen & food</div><div className="mt-1 text-xs text-slate-500">Find nearby food options</div></div></div><span className="text-amber-300 transition group-hover:translate-x-1">↗</span></div>
                </a>
              </div>
            )}
            {amenitiesStatus === 'unavailable' && <div className="mt-3 text-[11px] text-slate-500">The verified station facility feed is unavailable, so the links above open nearby map results instead of showing unverified information.</div>}
          </div>
        </section>
      )}

      <section className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="max-w-7xl mx-auto rounded-xl border border-sky-200 bg-white/75 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-700 font-mono font-bold">Past journey timings</div>
              <p className="mt-1 text-xs text-slate-600">Select one of the last five dates to see when the train reached each station.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {historicalTimetable && (
                <label htmlFor="history-date" className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Journey date</label>
              )}
              {historicalTimetable ? (
                <select
                  id="history-date"
                  value={selectedHistoryDate}
                  onChange={(event) => setSelectedHistoryDate(event.target.value)}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none ring-sky-300 focus:ring-2"
                >
                  {historicalTimetable.days.map((day) => (
                    <option key={day.date} value={day.date}>
                      {new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${day.date}T12:00:00`))}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadHistoricalTimetable()}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
                  disabled={historyLoading}
                >
                  {historyLoading ? 'Loading dates…' : 'Choose a previous date'}
                </button>
              )}
            </div>
          </div>

          {historyError && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">Historical timings could not be loaded. Start or restart the API server, then try again.</p>}

          {historicalTimetable && selectedHistoryDate && (() => {
            const selectedDay = historicalTimetable.days.find((day) => day.date === selectedHistoryDate);
            if (!selectedDay) return null;
            return (
              <div className="mt-3 overflow-hidden rounded-xl border border-sky-100 bg-sky-50/60">
                <div className="flex flex-col gap-2 border-b border-sky-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${selectedDay.date}T12:00:00`))}</h3>
                    <p className="mt-1 text-[11px] text-slate-600">{selectedDay.note}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold ${selectedDay.available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedDay.available ? 'Recorded timings' : 'No recorded run'}
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-sky-100 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    <span>Station</span><span>Assigned</span><span>Reached</span><span>Departed</span><span>Delay</span>
                  </div>
                  {selectedDay.timetable.map((stop) => (
                    <div key={`${selectedDay.date}-${stop.station_code}`} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-sky-100 px-4 py-2 text-xs last:border-b-0">
                      <div className="min-w-0"><div className="truncate font-semibold text-slate-800">{stop.station_name || stop.station_code}</div><div className="font-mono text-[10px] text-slate-500">{stop.station_code}</div></div>
                      <span className="font-mono text-slate-600">{stop.scheduled_arrival || '--:--'}</span>
                      <span className="font-mono font-semibold text-sky-700">{stop.actual_arrival_at ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(stop.actual_arrival_at)) : '—'}</span>
                      <span className="font-mono font-semibold text-sky-700">{stop.actual_departure_at ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(stop.actual_departure_at)) : '—'}</span>
                      <span className={`font-mono font-bold ${stop.delay_minutes !== null && stop.delay_minutes !== undefined && stop.delay_minutes > 0 ? 'text-amber-700' : stop.delay_minutes === 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{stop.delay_minutes === null || stop.delay_minutes === undefined ? '—' : stop.delay_minutes > 0 ? `+${stop.delay_minutes}m` : 'On time'}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-sky-100 px-4 py-2 text-[10px] text-slate-500">Assigned = scheduled arrival · Reached/Departed = stored provider timestamps</div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Main Content: Dual-Pane Operational Console */}
      {errorMsg ? (
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="panel-card p-8 text-center max-w-md border border-red-500/30">
            <div className="text-red-400 font-bold text-base mb-2">Transit Data Offline</div>
            <p className="text-xs text-slate-400 mb-6">{errorMsg}</p>
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold"
            >
              Return to train search
            </Link>
          </div>
        </div>
      ) : (
        <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (5 Cols): Station Timetable & Route Timeline */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            <div className="surface-3d p-4 flex flex-col h-[640px] rounded-2xl border border-white/[0.08] shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Halt Timetable & Progress</h3>
                  <div className="text-[11px] text-slate-400 font-mono">Select any halt to inspect on map</div>
                </div>
                <div className="text-xs font-mono text-cyan-400 font-bold">
                  {stations.length} Stops
                </div>
              </div>

              {/* Scrollable Halts List */}
              <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                {stations.map((stn, idx) => {
                  const isSelected = selectedStationCode === stn.code;
                  const currentIndex = Math.max(0, stations.findIndex((station) => station.code === currentLocation.station_code));
                  const isPassed = idx < currentIndex;
                  const isCurrent = idx === currentIndex;
                  const isDelayedStop = stn.delay > 5;

                  return (
                    <div
                      key={stn.code}
                      onClick={() => handleStationClick(stn)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.15)] ring-1 ring-cyan-400/40'
                          : 'bg-[#070b14]/60 hover:bg-white/[0.04] border-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isCurrent ? 'bg-cyan-300 animate-pulse' : isPassed ? 'bg-emerald-400' : isDelayedStop ? 'bg-amber-400' : 'bg-slate-500'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-white">{stn.code}</span>
                            {isCurrent && <span className="text-[9px] uppercase tracking-wider text-cyan-300 font-mono font-bold">Current</span>}
                            <span className="text-xs text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[180px]">
                              {stn.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {stn.plat}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-slate-400">{stn.sched}</span>
                          <span className="text-slate-600">➔</span>
                          <span className="font-bold text-white">{stn.pred}</span>
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`text-[10px] font-semibold ${
                              stn.delay === 0 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {stn.delay === 0 ? 'On Time' : `+${stn.delay}m`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timetable Legend */}
              <div className="pt-3 border-t border-white/[0.08] mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Departed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Delayed Stop</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Upcoming</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (7 Cols): Geospatial Map & Delay Diagnosis */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Geospatial Map Panel */}
            <div className="surface-3d p-2 border border-white/[0.08] flex flex-col h-[430px] rounded-2xl relative overflow-hidden shadow-2xl">
              
              {/* Map floating header controls */}
              <div className="absolute top-4 left-4 z-[400] bg-[#060a12]/90 backdrop-blur-md border border-cyan-400/30 px-3 py-1.5 rounded-xl flex items-center gap-2.5 text-xs font-mono shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" />
                <span className="font-bold text-white">Geospatial Corridor Route</span>
              </div>

              <div className="absolute top-4 right-14 z-[400] flex gap-1.5">
                <button
                  onClick={handleLocateTrain}
                  disabled={!leafletReady || stations.length === 0}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold border border-sky-500 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer shadow-sm"
                >
                  Locate Train
                </button>
                <button
                  onClick={handleFitRoute}
                  className="bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer backdrop-blur-md shadow-sm"
                >
                  Fit Route
                </button>
              </div>

              {/* Leaflet Map Mount Container */}
              <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
              <div className="absolute bottom-4 left-4 z-[400] bg-[#060a12]/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-[10px] font-mono text-slate-300 space-y-1">
                <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-cyan-300" /> Planned train corridor</div>
                <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-emerald-300" /> Completed section</div>
                <div className="text-slate-500 pt-0.5">{routeGeometry ? `Track geometry: ${routeGeometry.source || 'provider'}` : 'Track geometry unavailable; timetable fallback'}</div>
              </div>
            </div>

            {/* AI Delay Diagnosis & Uncertainty Radar */}
            <div className="surface-3d p-6 border border-white/[0.08] rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                    Causal Delay Diagnosis (SHAP Analysis)
                  </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Target: <span className="text-white font-bold">{currentSelectedStation?.name || 'Corridor'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-[#060a12]/80 border border-white/[0.06] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">Station Delay</div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      isDelayed ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {isDelayed ? `+${currentSelectedStation?.delay} min` : '0 min'}
                  </div>
                </div>

                <div className="bg-[#060a12]/80 border border-white/[0.06] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">AI Confidence</div>
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {currentSelectedStation?.conf || 94}%
                  </div>
                </div>

                <div className="bg-[#060a12]/80 border border-white/[0.06] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">Expected Arrival</div>
                  <div className="text-2xl font-black font-mono text-white">
                    {currentSelectedStation?.pred || '--:--'}
                  </div>
                </div>
              </div>

              {/* Delay Cause Banner */}
              <div
                className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                  isDelayed
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}
              >
                <div className={`mt-0.5 ${isDelayed ? 'text-amber-600' : 'text-emerald-600'}`} aria-label={isDelayed ? 'Delay warning' : 'On time'}>
                  {isDelayed ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.3 3.6-8 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
                      isDelayed ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {isDelayed ? 'Identified Corridor Factor' : 'Optimal Schedule Adherence'}
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed font-sans">
                    {delayReason}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.08] py-5 px-4 sm:px-6 lg:px-8 bg-[#070b14] text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>RailPulse • Indian Railways Operations & Telemetry Gateway</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-slate-300">Home</Link>
            <Link href="/operator" className="hover:text-slate-300">Admin control room</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
