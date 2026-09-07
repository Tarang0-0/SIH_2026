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

  // Fetch live predictions and timetable
  const fetchLivePredictions = useCallback(async (trainNo: string, requestedDate = journeyDateFromQuery) => {
    const targetNo = trainNo.trim();
    if (!targetNo) {
      setLoading(false);
      return;
    }
    setInputTrainNo(targetNo);
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
          setSelectedStationCode(mapped[0]?.code || null);
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

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Render Track Polyline
    const latlngs = mappableStations.map((s) => [s.lat, s.lon] as [number, number]);
    trackPolylineRef.current = L.polyline(latlngs, {
      color: '#0284c7',
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    if (latlngs.length > 1) {
      map.fitBounds(trackPolylineRef.current.getBounds(), { padding: [50, 50] });
    } else {
      map.setView(latlngs[0], 9);
    }

    // Render Station Pins
    markersMapRef.current = {};
    mappableStations.forEach((stn, idx) => {
      const isPassed = idx < Math.floor(mappableStations.length * 0.4);
      const isDelayed = stn.delay > 5;
      const pinClass = isPassed ? 'station-pin passed' : isDelayed ? 'station-pin delayed' : 'station-pin';

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: `<div class="${pinClass}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 14px; margin-bottom: 2px;">
            ${stn.code} - ${stn.name}
          </div>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${stn.plat}</div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
            <span>Sched Arrival:</span>
            <strong style="color: #f8fafc;">${stn.sched}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 3px;">
            <span>Predicted Arrival:</span>
            <strong style="color: #38bdf8;">${stn.pred}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);">
            <span>Delay Status:</span>
            <strong style="${stn.delay === 0 ? 'color: #34d399;' : 'color: #fbbf24;'}">
              ${stn.delay === 0 ? 'On Time' : `+${stn.delay} mins`}
            </strong>
          </div>
        </div>
      `;

      const marker = L.marker([stn.lat, stn.lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      markersMapRef.current[stn.code] = marker;
    });

    // Train Marker on Track
    const midIdx = Math.min(1, mappableStations.length - 1);
    const initialTrainPos: [number, number] = [mappableStations[midIdx].lat, mappableStations[midIdx].lon];

    const trainIcon = L.divIcon({
      className: 'train-icon-wrap',
      html: `<div class="train-live-marker">🚆</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    trainMarkerRef.current = L.marker(initialTrainPos, {
      icon: trainIcon,
      zIndexOffset: 1000,
    }).addTo(map);

  }, [leafletReady, stations]);

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

  const handleJourneyDateChange = (value: string) => {
    if (!value || !inputTrainNo.trim()) return;
    router.push(`/dashboard?train=${encodeURIComponent(inputTrainNo.trim())}&date=${encodeURIComponent(value)}`);
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
  const overallDelay = currentLocation.reported_delay_minutes ?? currentSelectedStation?.delay ?? 0;
  const isDelayed = overallDelay > 0;
  const delayReason = currentSelectedStation?.reason || 'Corridor operates within normal dispatch tolerance.';

  if (!trainFromQuery) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow flex items-center justify-center px-6 py-16">
          <div className="panel-card max-w-lg p-8 text-center">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-3">Live operations</div>
            <h1 className="text-2xl font-bold text-white mb-3">Choose a train to begin</h1>
            <p className="text-sm text-slate-400 mb-6">Search the live train directory first, then choose the journey date you want to inspect.</p>
            <Link href="/" className="inline-flex bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg">Open train search</Link>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Operations Header Banner */}
      <section className="bg-[#0d1322] border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-5">
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

          {/* Right Live Controls & Train Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="bg-[#111827] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono">
              <span className="block text-[10px] text-slate-500 uppercase mb-0.5">Journey date</span>
              <input
                type="date"
                value={journeyDate}
                onChange={(event) => handleJourneyDateChange(event.target.value)}
                className="bg-transparent text-sm font-semibold text-white outline-none [color-scheme:dark]"
                aria-label="Select journey date"
              />
            </label>
            <div className="bg-[#111827] border border-white/[0.08] rounded-lg px-3 py-2 flex items-center gap-4 text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Speed</div>
                <div className="text-sm font-bold text-white flex items-baseline gap-0.5">
                  <span className="text-blue-400">{liveGps.speed !== null ? liveGps.speed : '--'}</span>
                  <span className="text-[10px] text-slate-500">km/h</span>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-white/[0.08]" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase">RTIS Status</div>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveGps.positionAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>{liveGps.status}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center bg-[#111827] border border-slate-700 rounded-lg p-1">
              <input
                type="text"
                value={inputTrainNo}
                onChange={(e) => setInputTrainNo(e.target.value)}
                placeholder="Train No..."
                className="w-24 sm:w-28 px-2.5 py-1 text-xs font-mono text-white bg-transparent outline-none placeholder-slate-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>

        </div>
      </section>

      {currentLocation.next_station_prediction && (
        <section className="px-4 sm:px-6 lg:px-8 pt-5">
          <div className="max-w-7xl mx-auto panel-card px-4 py-3 border border-blue-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-300 font-mono">Next-station forecast</div>
              <div className="text-sm font-semibold text-white">
                {currentLocation.next_station_prediction.station_code} · {currentLocation.next_station_prediction.station_name || 'Next station'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-500">Predicted arrival </span>
                <span className="text-white font-semibold">{currentLocation.next_station_prediction.predicted_arrival}</span>
                <span className="text-slate-500"> ({currentLocation.next_station_prediction.predicted_minutes_to_next} min)</span>
              </div>
              <div>
                <span className="text-slate-500">Predicted delay </span>
                <span className="text-amber-300 font-semibold">+{currentLocation.next_station_prediction.predicted_delay_minutes} min</span>
              </div>
              {currentLocation.feedback?.latest_comparison && (
                <div>
                  <span className="text-slate-500">Latest observed error </span>
                  <span className="text-emerald-300 font-semibold">
                    {currentLocation.feedback.latest_comparison.error_minutes > 0 ? '+' : ''}
                    {currentLocation.feedback.latest_comparison.error_minutes} min
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
            
            <div className="panel-card p-4 flex flex-col h-[640px] border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Halt Timetable & Progress</h3>
                  <div className="text-[11px] text-slate-400 font-mono">Select any halt to inspect on map</div>
                </div>
                <div className="text-xs font-mono text-blue-400 font-bold">
                  {stations.length} Stops
                </div>
              </div>

              {/* Scrollable Halts List */}
              <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                {stations.map((stn, idx) => {
                  const isSelected = selectedStationCode === stn.code;
                  const isPassed = idx < Math.floor(stations.length * 0.4);
                  const isDelayedStop = stn.delay > 5;

                  return (
                    <div
                      key={stn.code}
                      onClick={() => handleStationClick(stn)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/80 shadow-sm'
                          : 'bg-[#0a0f1d] hover:bg-slate-800/60 border-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isPassed ? 'bg-emerald-400' : isDelayedStop ? 'bg-amber-400' : 'bg-slate-500'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-white">{stn.code}</span>
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
            <div className="panel-card p-2 border border-slate-800 flex flex-col h-[420px] relative overflow-hidden">
              
              {/* Map floating header controls */}
              <div className="absolute top-4 left-4 z-[400] bg-[#0d1322]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="font-bold text-white">Geospatial Corridor Route</span>
              </div>

              <div className="absolute top-4 right-14 z-[400] flex gap-1.5">
                <button
                  onClick={handleFitRoute}
                  className="bg-[#0d1322]/90 hover:bg-slate-800 text-slate-200 border border-white/10 px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer"
                >
                  Fit Route
                </button>
              </div>

              {/* Leaflet Map Mount Container */}
              <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
            </div>

            {/* AI Delay Diagnosis & Uncertainty Radar */}
            <div className="panel-card p-5 border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    Causal Delay Diagnosis (SHAP Analysis)
                  </h3>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Target: <span className="text-white font-bold">{currentSelectedStation?.name || 'Corridor'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-[#0a0f1d] border border-white/[0.06] p-3 rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">Station Delay</div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      isDelayed ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {isDelayed ? `+${currentSelectedStation?.delay} min` : '0 min'}
                  </div>
                </div>

                <div className="bg-[#0a0f1d] border border-white/[0.06] p-3 rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">AI Confidence</div>
                  <div className="text-2xl font-black font-mono text-blue-400">
                    {currentSelectedStation?.conf || 94}%
                  </div>
                </div>

                <div className="bg-[#0a0f1d] border border-white/[0.06] p-3 rounded-lg">
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
                <div className="text-base mt-0.5">{isDelayed ? '⚠️' : '✓'}</div>
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
            <Link href="/features" className="hover:text-slate-300">Architecture</Link>
            <Link href="/about" className="hover:text-slate-300">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
