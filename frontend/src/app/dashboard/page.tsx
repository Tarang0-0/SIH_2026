'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TrainLiveLocationCard from '../components/TrainLiveLocationCard';
import { useLanguage } from '../components/LanguageContext';
import { Calendar } from '@/components/ui/calendar';
import { apiUrl } from '../../lib/api';
import { frontendConfig } from '../../lib/config';

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
  distance_km?: number | null;
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
  getZoom?: () => number;
  setZoom?: (zoom: number) => void;
}

interface LeafletMarker {
  setLatLng: (position: [number, number]) => void;
  openPopup: () => void;
  bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletMarker;
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
    addTo: (map: LeafletMap) => LeafletMarker & {
      bindPopup: (content: string) => LeafletMarker;
      bindTooltip: (content: string, options?: Record<string, unknown>) => LeafletMarker;
    };
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
  const { t, language } = useLanguage();
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
    origin: '',
    dest: '',
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
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const historyPanelRef = useRef<HTMLDivElement>(null);

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
  const stationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const trainMarkerRef = useRef<LeafletMarker | null>(null);
  const trackPolylineRef = useRef<LeafletPolyline | null>(null);
  const markersMapRef = useRef<Record<string, LeafletMarker>>({});
  const [leafletReady, setLeafletReady] = useState(false);
  const [isLocationCardOpen, setIsLocationCardOpen] = useState(false);

  // SSE telemetry
  const [liveGps, setLiveGps] = useState({
    speed: null as number | null,
    status: '',
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
    setHistoryPanelOpen(false);
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
        const originResolved = data.origin_station || firstStop?.station_name || '';
        const destResolved = data.destination_station || lastStop?.station_name || '';

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
          status: location.position_available ? 'available' : 'unavailable',
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
          // Keep the complete route visible, but focus the next stop after the
          // provider's current station so the most useful row is selected.
          const currentIndex = mapped.findIndex((station) => station.code === location.station_code);
          const nextCode = location.next_station_code
            || (currentIndex >= 0 ? mapped[currentIndex + 1]?.code : null)
            || mapped[1]?.code
            || mapped[0]?.code
            || null;
          setSelectedStationCode(nextCode);
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

  useEffect(() => {
    if (!selectedStationCode) return;
    const scrollTimer = window.setTimeout(() => {
      stationRowRefs.current[selectedStationCode]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 0);
    return () => window.clearTimeout(scrollTimer);
  }, [selectedStationCode]);

  useEffect(() => {
    if (!historyPanelOpen) return;

    const closeWhenClickedOutside = (event: PointerEvent) => {
      if (historyPanelRef.current && !historyPanelRef.current.contains(event.target as Node)) {
        setHistoryPanelOpen(false);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryPanelOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenClickedOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickedOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [historyPanelOpen]);

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
    if (!frontendConfig.leafletCssUrl || !frontendConfig.leafletScriptUrl) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = frontendConfig.leafletCssUrl;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = frontendConfig.leafletScriptUrl;
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

    if (frontendConfig.mapTileUrl) {
      L.tileLayer(frontendConfig.mapTileUrl, {
        attribution: frontendConfig.mapTileAttribution, maxZoom: 18,
      }).addTo(map);
    }

    // Keep the real railway network visible underneath the timetable corridor.
    // The selected route remains highlighted, while this layer prevents the
    // map from implying that a straight station-to-station line is the track.
    if (frontendConfig.railwayTileUrl) {
      L.tileLayer(frontendConfig.railwayTileUrl, {
        attribution: frontendConfig.railwayTileAttribution, maxZoom: 19, opacity: 0.78,
      }).addTo(map);
    }

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

      const delayText = stn.delay > 0 ? `+${stn.delay}m` : 'On time';
      const delayClass = stn.delay > 0 ? 'delayed' : 'on-time';
      const marker = L.marker([stn.lat, stn.lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.bindTooltip(
        `<span class="station-delay-code">${escapeHtml(stn.code)}</span><span class="station-delay-value ${delayClass}">${escapeHtml(delayText)}</span>`,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -5],
          className: 'station-delay-label',
        },
      );

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
              status: data.gps.data_source || 'unavailable',
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
  const currentStationIndex = stations.findIndex((station) => station.code === currentLocation.station_code);
  const fallbackUpcomingStation = currentStationIndex >= 0
    ? stations[currentStationIndex + 1]
    : stations[1];
  const upcomingStation = currentLocation.next_station_prediction ?? (
    fallbackUpcomingStation
      ? {
          station_code: fallbackUpcomingStation.code,
          station_name: fallbackUpcomingStation.name,
          scheduled_arrival: fallbackUpcomingStation.sched,
          predicted_arrival: fallbackUpcomingStation.pred,
          predicted_minutes_to_next: null,
          distance_km: null,
          predicted_delay_minutes: fallbackUpcomingStation.delay,
        }
      : null
  );
  const currentStation = stations.find((station) => station.code === currentLocation.station_code) || stations[0];
  const currentStationLabel = currentStation
    ? `${currentStation.code} · ${currentStation.name}`
    : currentLocation.station_code || t('dash_location_unavailable', 'Current location unavailable');
  const facilityStation = stations.find((station) => station.code === facilityStationCode) || currentStation;
  const facilityStationName = facilityStation?.name || facilityStationCode || t('dash_selected_station', 'Selected station');
  const waitingAreaSearchUrl = frontendConfig.mapSearchUrl
    ? `${frontendConfig.mapSearchUrl}${encodeURIComponent(`${facilityStationName} railway station waiting room`)}`
    : '';
  const canteenSearchUrl = frontendConfig.mapSearchUrl
    ? `${frontendConfig.mapSearchUrl}${encodeURIComponent(`${facilityStationName} railway station canteen`)}`
    : '';

  const handleLocateTrain = () => {
    const hasGps = liveGps.positionAvailable && liveGps.lat !== null && liveGps.lon !== null;
    const target = hasGps
      ? [liveGps.lat as number, liveGps.lon as number] as [number, number]
      : currentStation?.lat !== null && currentStation?.lat !== undefined && currentStation?.lon !== null && currentStation?.lon !== undefined
        ? [currentStation.lat, currentStation.lon] as [number, number]
        : null;
    if (!target || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(target);
    if (mapInstanceRef.current.getZoom && mapInstanceRef.current.getZoom() < 8 && mapInstanceRef.current.setZoom) {
      mapInstanceRef.current.setZoom(9);
    }
    if (hasGps) {
      trainMarkerRef.current?.openPopup();
    } else if (currentStation) {
      markersMapRef.current[currentStation.code]?.openPopup();
    }
    setIsLocationCardOpen(true);
  };
  const overallDelay = currentLocation.reported_delay_minutes ?? currentSelectedStation?.delay ?? 0;
  const isDelayed = overallDelay > 0;
  const delayReason = currentSelectedStation?.reason || t('dash_normal_dispatch', 'No provider delay reason is available.');

  if (!trainFromQuery) {
    return (
      <div className="dashboard-light min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans">
        <Navbar />
        <main id="main-content" className="flex-grow flex items-center justify-center px-6 py-16">
          <div className="surface-3d max-w-lg p-8 text-center rounded-2xl border border-sky-200/80 dark:border-sky-800/60 shadow-sm">
            <div className="text-xs uppercase tracking-widest text-sky-700 dark:text-sky-400 font-mono font-bold mb-3">{t('dash_live_operations', 'Live operations')}</div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{t('dash_choose_train', 'Choose a train to begin')}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{t('dash_choose_desc', 'Search the live train directory first, then choose a train to inspect its current location and next stop.')}</p>
            <Link href="/" className="inline-flex bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition-colors">{t('dash_open_search', 'Open train search')}</Link>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-light min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-3 border-sky-500/20 border-t-sky-600 dark:border-t-sky-400 rounded-full animate-spin mb-4"></div>
          <div className="text-base font-bold font-mono text-slate-900 dark:text-white tracking-wide">{t('dash_acquiring', 'Acquiring Live Transit Stream...')}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">Train #{inputTrainNo} • RTIS Telemetry Gateway</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-light min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main id="main-content" className="flex-1 flex flex-col">

      {/* Operations Header Banner */}
      <section className="bg-white/85 dark:bg-[#0b1528]/90 backdrop-blur-md border-b border-sky-200/80 dark:border-sky-800/60 px-4 sm:px-6 lg:px-8 py-4 shadow-xs dark:shadow-[0_4px_25px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Train Identity & Journey Bar */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {trainDetails.train_number}
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                {trainDetails.train_name}
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-mono font-bold tracking-wide transition-all ${
                  overallDelay > 15
                    ? 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-500/50 text-rose-800 dark:text-rose-300'
                    : isDelayed
                    ? 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {overallDelay > 15 ? `+${overallDelay} MIN ${t('dash_severe_delay', 'SEVERE DELAY')}` : isDelayed ? `+${overallDelay} MIN ${t('dash_delayed', 'DELAYED')}` : t('dash_on_schedule', 'ON SCHEDULE')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-slate-500">{t('dash_origin', 'Origin:')}</span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">{trainDetails.origin}</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold">({stations[0]?.sched || '--:--'})</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">➔</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-slate-500">{t('dash_destination', 'Destination:')}</span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold">{trainDetails.dest}</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold">({stations[stations.length - 1]?.sched || '--:--'})</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <div className="hidden sm:flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span>{stations.length} {t('dash_scheduled_halts', 'Scheduled Halts')}</span>
              </div>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <button
                type="button"
                onClick={() => {
                  setHistoryPanelOpen(true);
                  if (!historicalTimetable) void loadHistoricalTimetable();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800 text-xs font-mono text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors cursor-pointer"
                title="Click to view train journey calendar"
                aria-label="Open train journey calendar"
              >
                <svg className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Journey {currentLocation.journey_date || journeyDate || '--'}</span>
              </button>
            </div>
          </div>

          {/* Train switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex items-center bg-white dark:bg-[#07101e] border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-xs">
              <input
                type="text"
                value={inputTrainNo}
                onChange={(e) => setInputTrainNo(e.target.value)}
                placeholder={t('search_input_placeholder', 'Train No...')}
                className="w-24 sm:w-28 px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder-slate-400 dark:placeholder-slate-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer shadow-xs"
              >
                {t('dash_track_btn', 'Track')}
              </button>
            </form>
          </div>

        </div>
      </section>

      {upcomingStation && (
        <section className="px-4 sm:px-6 lg:px-8 pt-5">
          <div className="max-w-7xl mx-auto panel-card px-5 py-5 sm:px-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09152b] shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono font-bold">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  {t('dash_upcoming_station', 'Upcoming station')}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                  {upcomingStation.station_name || upcomingStation.station_code}
                  <span className="ml-2 text-sm sm:text-base font-mono font-semibold text-sky-600 dark:text-sky-400">({upcomingStation.station_code})</span>
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {t('dash_currently_at', 'Currently at')} <span className="font-semibold text-slate-800 dark:text-slate-200">{currentStationLabel}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-7">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{t('dash_expected_arrival', 'Expected arrival')}</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">{upcomingStation.predicted_arrival}</div>
                  {upcomingStation.predicted_minutes_to_next !== null && upcomingStation.predicted_minutes_to_next !== undefined && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{t('dash_in_about', 'in about')} {upcomingStation.predicted_minutes_to_next} {t('card_delayed', 'min')}</div>
                  )}
                </div>
                <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{t('dash_delay_at_station', 'Delay at this station')}</div>
                  <div className={`mt-1 text-2xl sm:text-3xl font-black font-mono ${upcomingStation.predicted_delay_minutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {upcomingStation.predicted_delay_minutes > 0 ? `+${upcomingStation.predicted_delay_minutes} min` : t('card_on_time', 'On time')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{t('dash_scheduled', 'Scheduled')} {upcomingStation.scheduled_arrival}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-900/60 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span>{t('dash_forecast_confidence', 'Forecast confidence')}: <strong className="text-slate-900 dark:text-slate-200 font-bold">{stations[1]?.conf ?? '—'}%</strong></span>
              <span>{t('dash_route_progress', 'Route progress')}: <strong className="text-slate-900 dark:text-slate-200 font-bold">{Math.round(currentLocation.route_progress_percent ?? 0)}%</strong></span>
              {currentLocation.feedback?.latest_comparison && (
                <span>{t('dash_observed_error', 'Latest observed error')}: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{currentLocation.feedback.latest_comparison.error_minutes > 0 ? '+' : ''}{currentLocation.feedback.latest_comparison.error_minutes} min</strong></span>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 sm:px-6 lg:px-8 pt-5">
        <div ref={historyPanelRef} className="max-w-7xl mx-auto rounded-xl border border-sky-200 dark:border-sky-800/80 bg-white/75 dark:bg-[#0b1528]/85 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-700 dark:text-sky-400 font-mono font-bold">{t('dash_past_journey_timings', 'Past journey timings')}</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Select one of the last five dates to see when the train reached each station.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextState = !historyPanelOpen;
                  setHistoryPanelOpen(nextState);
                  if (nextState && !historicalTimetable) void loadHistoricalTimetable();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                disabled={historyLoading}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{historyLoading ? t('dash_loading_calendar', 'Loading calendar…') : historyPanelOpen ? t('dash_close_calendar', 'Close Calendar') : t('dash_select_date_btn', 'Select Journey Date')}</span>
              </button>
            </div>
          </div>

          {historyPanelOpen && (
            <div className="mt-4 pt-4 border-t border-sky-100 dark:border-sky-900/60">
              <Calendar
                selectedDate={selectedHistoryDate || journeyDate}
                onSelectDate={(newDate) => {
                  setSelectedHistoryDate(newDate);
                  void fetchLivePredictions(trainDetails.train_number, newDate);
                }}
                availableDates={historicalTimetable ? historicalTimetable.days.map((d) => d.date) : []}
                title={`Train #${trainDetails.train_number} ${t('dash_journey_calendar', 'Journey Calendar')}`}
                description={t('dash_pick_date_desc', 'Pick any date from the interactive calendar to view recorded arrivals, departures, and delay explanations.')}
                actionLabel={t('dash_track_selected_date', 'Track Selected Date')}
                onActionClick={() => {
                  if (selectedHistoryDate) {
                    router.push(`/dashboard?train=${encodeURIComponent(trainDetails.train_number)}&date=${encodeURIComponent(selectedHistoryDate)}`);
                  }
                }}
              />
            </div>
          )}

          {historyPanelOpen && historyError && <p className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">Historical timings could not be loaded. Start or restart the API server, then try again.</p>}

          {historyPanelOpen && historicalTimetable && selectedHistoryDate && (() => {
            const selectedDay = historicalTimetable.days.find((day) => day.date === selectedHistoryDate);
            if (!selectedDay) return null;
            return (
              <div className="mt-3 overflow-hidden rounded-xl border border-sky-100 dark:border-sky-900/60 bg-sky-50/60 dark:bg-[#071224]/80">
                <div className="flex flex-col gap-2 border-b border-sky-100 dark:border-sky-900/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${selectedDay.date}T12:00:00`))}</h3>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{selectedDay.note}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-mono font-bold ${selectedDay.available ? 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'}`}>
                    {selectedDay.available ? t('dash_recorded_timings', 'Recorded timings') : t('dash_no_recorded_run', 'No recorded run')}
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-sky-100 dark:border-sky-900/60 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{t('dash_station_col', 'Station')}</span><span>{t('dash_assigned', 'Assigned')}</span><span>{t('dash_reached', 'Reached')}</span><span>{t('dash_departed_col', 'Departed')}</span><span>{t('dash_delay_col', 'Delay')}</span>
                  </div>
                  {selectedDay.timetable.map((stop) => (
                    <div key={`${selectedDay.date}-${stop.station_code}`} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-sky-100 dark:border-sky-900/40 px-4 py-2 text-xs last:border-b-0">
                      <div className="min-w-0"><div className="truncate font-semibold text-slate-800 dark:text-slate-200">{stop.station_name || stop.station_code}</div><div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{stop.station_code}</div></div>
                      <span className="font-mono text-slate-600 dark:text-slate-400">{stop.scheduled_arrival || '--:--'}</span>
                      <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">{stop.actual_arrival_at ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(stop.actual_arrival_at)) : '—'}</span>
                      <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">{stop.actual_departure_at ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(stop.actual_departure_at)) : '—'}</span>
                      <span className={`font-mono font-bold ${stop.delay_minutes !== null && stop.delay_minutes !== undefined && stop.delay_minutes > 0 ? 'text-amber-700 dark:text-amber-400' : stop.delay_minutes === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{stop.delay_minutes === null || stop.delay_minutes === undefined ? '—' : stop.delay_minutes > 0 ? `+${stop.delay_minutes}m` : t('card_on_time', 'On time')}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-sky-100 dark:border-sky-900/60 px-4 py-2 text-[10px] text-slate-500 dark:text-slate-400">{t('dash_timetable_legend_note', 'Assigned = scheduled arrival · Reached/Departed = stored provider timestamps')}</div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Main Content: Dual-Pane Operational Console */}
      {errorMsg ? (
        <div className="flex-grow flex items-center justify-center p-6">
          <div className="surface-3d p-8 text-center max-w-md border border-rose-300 rounded-2xl shadow-sm">
            <div className="text-rose-600 font-bold text-base mb-2">{t('dash_transit_offline', 'Transit Data Offline')}</div>
            <p className="text-xs text-slate-600 mb-6">{errorMsg}</p>
            <Link
              href="/"
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {t('dash_return_search', 'Return to train search')}
            </Link>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl w-full mx-auto px-4 pt-6 pb-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (5 Cols): Station Timetable & Route Timeline */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            <div className="surface-3d p-4 flex flex-col rounded-2xl border border-sky-200/80 dark:border-sky-800/60 shadow-sm h-[680px]">
              <div className="flex items-center justify-between pb-3 border-b border-sky-100 dark:border-sky-900/60 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('dash_timeline_title', 'Halt Timetable & Progress')}</h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{t('dash_full_route_note', 'Full route · next stop selected automatically')}</div>
                </div>
                <div className="text-xs font-mono text-sky-700 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800/70 px-2.5 py-0.5 rounded-full">
                  {stations.length} {t('dash_stops', 'Stops')}
                </div>
              </div>

              {/* Scrollable Halts List */}
              <div className="flex-grow overflow-y-auto space-y-2 pr-1 max-h-[560px]">
                {stations.map((stn, idx) => {
                  const isSelected = selectedStationCode === stn.code;
                  const currentIndex = Math.max(0, stations.findIndex((station) => station.code === currentLocation.station_code));
                  const isPassed = idx < currentIndex;
                  const isCurrent = idx === currentIndex;
                  const isDelayedStop = stn.delay > 5;

                  return (
                    <div
                      key={stn.code}
                      ref={(element) => {
                        stationRowRefs.current[stn.code] = element;
                      }}
                      onClick={() => handleStationClick(stn)}
                      className={`h-16 flex-shrink-0 p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-sky-100/90 dark:bg-sky-950/80 border-sky-400 dark:border-sky-400 shadow-md ring-1 ring-sky-300 dark:ring-sky-500/50'
                          : 'bg-white/80 dark:bg-[#0c1729]/80 hover:bg-sky-50/60 dark:hover:bg-[#122340] border-slate-200/70 dark:border-slate-800/80 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isCurrent
                              ? 'bg-blue-500 animate-pulse'
                              : isPassed
                                ? 'bg-emerald-500'
                                : isDelayedStop
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{stn.code}</span>
                            {isCurrent && <span className="text-[9px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-mono font-bold bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">{t('dash_current', 'Current')}</span>}
                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[180px]">
                              {stn.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            {stn.plat}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-slate-400 dark:text-slate-500">{stn.sched}</span>
                          <span className="text-slate-300 dark:text-slate-600">➔</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{stn.pred}</span>
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`text-[10px] font-semibold ${
                              stn.delay === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {stn.delay === 0 ? t('card_on_time', 'On Time') : `+${stn.delay}m`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timetable Legend */}
              <div className="pt-3 border-t border-sky-100 dark:border-sky-900/60 mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{t('dash_departed', 'Departed')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{t('dash_delayed_stop', 'Delayed Stop')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>{t('dash_upcoming', 'Upcoming')}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (7 Cols): Geospatial Map & Delay Diagnosis */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Geospatial Map Panel */}
            <div className="surface-3d p-2 border border-slate-200 dark:border-slate-800 flex flex-col h-[400px] rounded-2xl relative overflow-hidden shadow-sm">
              
              {/* Map floating header controls */}
              <div className="absolute top-4 left-4 z-[400] bg-white/95 dark:bg-[#0b1528]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono shadow-xs text-slate-800 dark:text-slate-200">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-bold text-slate-900 dark:text-white">{t('map_title', 'Geospatial Corridor Route')}</span>
              </div>

              <div className="absolute top-4 right-14 z-[400] flex gap-1.5">
                <button
                  onClick={handleLocateTrain}
                  disabled={!leafletReady || stations.length === 0}
                  className="group relative flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                  title="Where is my train? Check live location, delay status and next station timing"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
                  </span>
                  <span>{t('map_where_is_my_train', 'Where is my train?')}</span>
                </button>
                <button
                  onClick={handleFitRoute}
                  className="bg-white/95 dark:bg-[#0c1729]/95 hover:bg-slate-50 dark:hover:bg-[#162744] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer backdrop-blur-md shadow-xs"
                >
                  {t('map_fit_route', 'Fit Route')}
                </button>
              </div>

              {/* Train Location & Delay Card Overlay */}
              <div className="absolute top-14 left-4 z-[450] max-w-[calc(100%-2rem)]">
                <TrainLiveLocationCard
                  trainNumber={inputTrainNo || trainDetails.train_number}
                  trainName={trainDetails.train_name || t('dash_train_name_unavailable', 'Train name unavailable')}
                  currentStationCode={currentStation?.code}
                  currentStationName={currentStation?.name}
                  delayMinutes={overallDelay}
                  nextStationCode={upcomingStation?.station_code || t('dash_next_station_unavailable', 'Not available')}
                  nextStationName={upcomingStation?.station_name || t('dash_next_stop_unavailable', 'Next stop unavailable')}
                  scheduledArrival={upcomingStation?.scheduled_arrival || '--:--'}
                  predictedArrival={upcomingStation?.predicted_arrival || '--:--'}
                  speedKmH={liveGps.speed}
                  distanceKmToNext={upcomingStation?.distance_km ?? null}
                  routeProgressPercent={currentLocation.route_progress_percent}
                  isOpen={isLocationCardOpen}
                  onClose={() => setIsLocationCardOpen(false)}
                  onCenterOnTrain={handleLocateTrain}
                />
              </div>

              {/* Leaflet Map Mount Container */}
              <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
              <div className="absolute bottom-4 left-4 z-[400] bg-white/95 dark:bg-[#0b1528]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-[10px] font-mono text-slate-700 dark:text-slate-300 shadow-xs space-y-1">
                <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-blue-500" /> {t('dash_planned_corridor', 'Planned train corridor')}</div>
                <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-emerald-500" /> {t('dash_completed_section', 'Completed section')}</div>
                <div className="text-slate-500 dark:text-slate-400 pt-0.5">{routeGeometry ? `${t('dash_track_geometry', 'Track geometry')}: ${routeGeometry.source || t('dash_provider', 'provider')}` : t('dash_track_geometry_unavailable', 'Track geometry unavailable; timetable fallback')}</div>
              </div>
            </div>

            {/* AI Delay Diagnosis & Uncertainty Radar */}
            <div className="surface-3d p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {t('dash_causal_diagnosis', 'Causal Delay Diagnosis (SHAP Analysis)')}
                  </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {t('dash_target', 'Target')}: <span className="text-slate-900 dark:text-white font-bold">{currentSelectedStation?.name || 'Corridor'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white/95 dark:bg-[#0c1729]/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
                  <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 mb-1">{t('dash_station_delay', 'Station Delay')}</div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isDelayed ? `+${currentSelectedStation?.delay} min` : '0 min'}
                  </div>
                </div>

                <div className="bg-white/95 dark:bg-[#0c1729]/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
                  <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 mb-1">{t('dash_ai_confidence', 'AI Confidence')}</div>
                  <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                    {currentSelectedStation?.conf || 94}%
                  </div>
                </div>

                <div className="bg-white/95 dark:bg-[#0c1729]/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
                  <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 mb-1">{t('dash_expected_arrival', 'Expected Arrival')}</div>
                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {currentSelectedStation?.pred || '--:--'}
                  </div>
                </div>
              </div>

              {/* Delay Cause Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                  isDelayed
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40'
                }`}
              >
                <div className={`mt-0.5 ${isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} aria-label={isDelayed ? 'Delay warning' : 'On time'}>
                  {isDelayed ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.3 3.6-8 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
                      isDelayed ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {isDelayed ? t('dash_factor_identified', 'Identified Corridor Factor') : t('dash_schedule_adherence', 'Optimal Schedule Adherence')}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                    {delayReason}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>
      )}

      {/* Passenger Facilities (Station Amenities) - Cleanly spaced below main */}
      {facilityStation && (
        <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          <div className="surface-3d rounded-2xl p-5 border border-sky-200/80 dark:border-sky-800/60 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-sky-700 dark:text-sky-400 font-mono font-bold">{t('dash_passenger_facilities', 'Passenger facilities')}</div>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{t('dash_nearby_at', 'Nearby at')} {facilityStationName} <span className="text-sm font-mono text-slate-500 dark:text-slate-400">({facilityStation.code})</span></h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('dash_station_help_subtitle', 'Optional station support while you wait for the train.')}</p>
              </div>
              {amenitiesStatus === 'loading' && <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{t('dash_checking_options', 'Checking station options…')}</span>}
            </div>

            {amenitiesStatus === 'ready' && stationAmenities?.amenities.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stationAmenities.amenities.map((amenity) => (
                  <div key={amenity.id} className="rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-white/90 dark:bg-[#0c1729]/90 p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div className="font-semibold text-slate-900 dark:text-white">{amenity.name}</div><span className="rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-500/40 px-2 py-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300">{amenity.status}</span></div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">{amenity.type} · {amenity.platform || t('dash_station_concourse', 'Station concourse')}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">{amenity.occupancy && <span>{amenity.occupancy}</span>}{amenity.cost && <span>{amenity.cost}</span>}{amenity.amenities.map((item) => <span key={item} className="text-sky-700 dark:text-sky-400">{item}</span>)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a href={waitingAreaSearchUrl || undefined} aria-disabled={!waitingAreaSearchUrl} onClick={(event) => { if (!waitingAreaSearchUrl) event.preventDefault(); }} target="_blank" rel="noreferrer" className="group rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-white/90 dark:bg-[#0c1729]/90 p-4 shadow-sm transition hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-[#122340]">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4v16M19 4v16M5 5h14M5 12h14M7 20h-3M20 20h-3"/><path d="M8 12v8M16 12v8"/></svg></span><div><div className="text-sm font-bold text-slate-900 dark:text-white">{t('dash_waiting_area', 'Waiting area')}</div><div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('dash_find_nearest_waiting', 'Find the nearest mapped option')}</div></div></div><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-sky-500 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
                </a>
                <a href={canteenSearchUrl || undefined} aria-disabled={!canteenSearchUrl} onClick={(event) => { if (!canteenSearchUrl) event.preventDefault(); }} target="_blank" rel="noreferrer" className="group rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-white/90 dark:bg-[#0c1729]/90 p-4 shadow-sm transition hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-[#1f2618]/40">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10h12a1 1 0 0 1 1 1c0 3-2.5 5-7 5s-7-2-7-5a1 1 0 0 1 1-1Z"/><path d="M8 18h8M9 20h6M12 7v3M9 7c0-2 1.5-3 3-3s3 1 3 3"/></svg></span><div><div className="text-sm font-bold text-slate-900 dark:text-white">{t('dash_canteen_food', 'Canteen & food')}</div><div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('dash_find_nearby_food', 'Find nearby food options')}</div></div></div><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-amber-500 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
                </a>
              </div>
            )}
            {amenitiesStatus === 'unavailable' && <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{t('dash_facility_unavailable', 'Verified station facility data is unavailable; these links open nearby map results instead.')}</div>}
          </div>
        </section>
      )}

      </main>
      <Footer />
    </div>
  );
}
