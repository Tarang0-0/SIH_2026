'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TrainLiveLocationCard from '../components/TrainLiveLocationCard';
import { useLanguage } from '../components/LanguageContext';
import { apiUrl } from '../../lib/api';

interface StationRecord {
  code: string;
  name: string;
  sched: string;
  pred: string;
  delay: number;
  lat: number | null;
  lon: number | null;
}

type MappableStation = StationRecord & { lat: number; lon: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLeaflet = any;

function MapContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const trainFromQuery = searchParams.get('train') || '12951';

  const [trainNumber, setTrainNumber] = useState(trainFromQuery);
  const [searchInput, setSearchInput] = useState(trainFromQuery);
  const [trainName, setTrainName] = useState('Mumbai Rajdhani Express');
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [currentStationCode, setCurrentStationCode] = useState('');
  const [currentStationName, setCurrentStationName] = useState('');
  const [nextStationCode, setNextStationCode] = useState('');
  const [nextStationName, setNextStationName] = useState('');
  const [scheduledArrival, setScheduledArrival] = useState('--:--');
  const [predictedArrival, setPredictedArrival] = useState('--:--');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [speedKmH] = useState<number | null>(92);
  const [routeProgressPercent, setRouteProgressPercent] = useState(35);

  const [isLocationCardOpen, setIsLocationCardOpen] = useState(true);
  const [leafletReady, setLeafletReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AnyLeaflet>(null);
  const trainMarkerRef = useRef<AnyLeaflet>(null);
  const trackPolylineRef = useRef<AnyLeaflet>(null);

  // Load Leaflet Scripts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).L) {
      // Leaflet may already be loaded by another page; this is an intentional
      // readiness update after the external script check.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    }
  }, []);

  // Fetch Train ETA and Route details
  const fetchTrainData = useCallback(async (trainNo: string) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/trains/${encodeURIComponent(trainNo)}/eta`));
      if (!res.ok) throw new Error('Train details unavailable');
      const data = await res.json();

      setTrainName(data.train_name || 'Express Corridor Service');
      const stns: StationRecord[] = (data.stations || []).map((s: {
        station_code: string;
        station_name?: string;
        scheduled_arrival: string;
        predicted_arrival: string;
        delay_minutes: number;
        latitude: number | null;
        longitude: number | null;
      }) => ({
        code: s.station_code,
        name: s.station_name || s.station_code,
        sched: s.scheduled_arrival,
        pred: s.predicted_arrival,
        delay: s.delay_minutes,
        lat: s.latitude,
        lon: s.longitude,
      }));

      setStations(stns);

      const currLoc = data.current_location || {};
      const currCode = currLoc.station_code || (stns[0] ? stns[0].code : '');
      const currStn = stns.find((s) => s.code === currCode) || stns[0];
      setCurrentStationCode(currCode);
      setCurrentStationName(currStn?.name || currCode);

      const nextPred = currLoc.next_station_prediction;
      if (nextPred) {
        setNextStationCode(nextPred.station_code);
        setNextStationName(nextPred.station_name);
        setScheduledArrival(nextPred.scheduled_arrival);
        setPredictedArrival(nextPred.predicted_arrival);
        setDelayMinutes(nextPred.predicted_delay_minutes || 0);
      } else {
        const currIdx = stns.findIndex((s) => s.code === currCode);
        const fallbackNext = currIdx >= 0 && stns[currIdx + 1] ? stns[currIdx + 1] : stns[1] || stns[0];
        if (fallbackNext) {
          setNextStationCode(fallbackNext.code);
          setNextStationName(fallbackNext.name);
          setScheduledArrival(fallbackNext.sched);
          setPredictedArrival(fallbackNext.pred);
          setDelayMinutes(fallbackNext.delay);
        }
      }

      setRouteProgressPercent(currLoc.route_progress_percent || 30);
      setIsLocationCardOpen(true);
    } catch {
      // Ignore network errors on initial render
    }
  }, []);

  useEffect(() => {
    // This effect is the component's external-data subscription boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrainData(trainNumber);
  }, [trainNumber, fetchTrainData]);

  // Render Map
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || stations.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const mappableStations = stations.filter(
      (s): s is MappableStation => s.lat !== null && s.lon !== null
    );
    if (mappableStations.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const firstStn = mappableStations[0];
    const map = L.map(mapContainerRef.current, {
      center: [firstStn.lat, firstStn.lon],
      zoom: 7,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    // Base OSM layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // OpenRailwayMap layer
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenRailwayMap',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const latlngs = mappableStations.map((s) => [s.lat, s.lon] as [number, number]);

    // Track polyline
    const polyline = L.polyline(latlngs, {
      color: '#0284c7',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);
    trackPolylineRef.current = polyline;

    map.fitBounds(polyline.getBounds(), { padding: [60, 60] });

    // Station dots
    mappableStations.forEach((stn) => {
      const stationIcon = L.divIcon({
        className: 'station-pin',
        html: `<div style="width: 10px; height: 10px; background: #0284c7; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(2,132,199,0.7);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const stnMarker = L.marker([stn.lat, stn.lon], { icon: stationIcon }).addTo(map);
      stnMarker.bindPopup(`<b>${stn.code} - ${stn.name}</b><br/>Scheduled: ${stn.sched}<br/>Expected: ${stn.pred}`);
    });

    // Train Beacon Marker
    const currStn = mappableStations.find((s) => s.code === currentStationCode) || mappableStations[Math.min(1, mappableStations.length - 1)];
    const trainCoords: [number, number] = [currStn.lat, currStn.lon];

    const trainIcon = L.divIcon({
      className: 'train-beacon',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; items-center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: #0284c7; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #2563eb); border: 3px solid #ffffff; box-shadow: 0 4px 15px rgba(2,132,199,0.6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 15px;">
            🚂
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const marker = L.marker(trainCoords, { icon: trainIcon, zIndexOffset: 1000 }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: monospace; font-size: 12px; padding: 4px;">
        <div style="font-weight: bold; color: #0284c7; margin-bottom: 4px;">Train #${trainNumber}</div>
        <div>${currStn.code} - ${currStn.name}</div>
        <div>Delay: <b>${delayMinutes > 0 ? `+${delayMinutes} min` : 'On Time'}</b></div>
      </div>
    `);
    trainMarkerRef.current = marker;

  }, [leafletReady, stations, currentStationCode, trainNumber, delayMinutes]);

  const handleLocateTrain = () => {
    if (!mapInstanceRef.current || stations.length === 0) return;
    const mappable = stations.filter((s): s is MappableStation => s.lat !== null && s.lon !== null);
    const currStn = mappable.find((s) => s.code === currentStationCode) || mappable[Math.min(1, mappable.length - 1)];
    if (!currStn) return;

    mapInstanceRef.current.panTo([currStn.lat, currStn.lon]);
    if (mapInstanceRef.current.getZoom && mapInstanceRef.current.getZoom() < 8 && mapInstanceRef.current.setZoom) {
      mapInstanceRef.current.setZoom(9);
    }
    trainMarkerRef.current?.openPopup();
    setIsLocationCardOpen(true);
  };

  const handleFitRoute = () => {
    if (mapInstanceRef.current && trackPolylineRef.current) {
      mapInstanceRef.current.fitBounds(trackPolylineRef.current.getBounds(), { padding: [60, 60] });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) return;
    setTrainNumber(clean);
    router.push(`/map?train=${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fc] dark:bg-[#070c18] text-[#1e293b] dark:text-slate-100 font-sans transition-colors duration-200">
      <Navbar />

      <main className="flex-1 flex flex-col relative">
        {/* Top Floating Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Train Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="pointer-events-auto flex items-center bg-white/95 dark:bg-[#0b1528]/95 backdrop-blur-xl border border-sky-300/70 dark:border-sky-800/80 rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(2,132,199,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] max-w-sm sm:max-w-md w-full"
          >
            <div className="pl-3 pr-2 text-sky-600 dark:text-cyan-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('map_search_placeholder', 'Search train (e.g. 12951, 12002)')}
              className="flex-1 bg-transparent text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none pr-2"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-xs font-bold transition shadow-xs cursor-pointer"
            >
              {t('map_track_btn', 'Track')}
            </button>
          </form>

          {/* Map Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Prominent "Where is My Train?" Button */}
            <button
              type="button"
              onClick={handleLocateTrain}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-blue-500 text-white font-mono text-xs sm:text-sm font-black shadow-lg shadow-sky-600/30 hover:shadow-sky-500/40 border border-sky-300/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
              </span>
              <span>{t('map_where_is_my_train', 'Where is my train?')}</span>
            </button>

            <button
              type="button"
              onClick={handleFitRoute}
              className="px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-[#0b1528]/95 backdrop-blur-xl border border-sky-300/70 dark:border-sky-800/80 text-slate-800 dark:text-slate-200 font-mono text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
            >
              {t('map_fit_route', 'Fit Route')}
            </button>
          </div>
        </div>

        {/* Quick Corridor Selection Chips */}
        <div className="absolute top-20 left-4 z-[400] flex flex-wrap gap-1.5 pointer-events-auto">
          {[
            { no: '12951', label: '12951 Mumbai Rajdhani' },
            { no: '12002', label: '12002 Bhopal Shatabdi' },
            { no: '22436', label: '22436 Vande Bharat' },
          ].map((item) => (
            <button
              key={item.no}
              type="button"
              onClick={() => {
                setSearchInput(item.no);
                setTrainNumber(item.no);
                router.push(`/map?train=${item.no}`);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition shadow-xs cursor-pointer ${
                trainNumber === item.no
                  ? 'bg-sky-600 text-white border border-sky-500 shadow-sky-500/20'
                  : 'bg-white/90 dark:bg-[#0b1528]/90 text-slate-700 dark:text-slate-300 border border-sky-200/80 dark:border-sky-800 hover:border-sky-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Floating Train Live Location Card */}
        <div className="absolute top-32 left-4 z-[450] max-w-[calc(100%-2rem)]">
          <TrainLiveLocationCard
            trainNumber={trainNumber}
            trainName={trainName}
            currentStationCode={currentStationCode}
            currentStationName={currentStationName}
            delayMinutes={delayMinutes}
            nextStationCode={nextStationCode || 'Next Station'}
            nextStationName={nextStationName || 'Upcoming Halt'}
            scheduledArrival={scheduledArrival}
            predictedArrival={predictedArrival}
            speedKmH={speedKmH}
            routeProgressPercent={routeProgressPercent}
            isOpen={isLocationCardOpen}
            onClose={() => setIsLocationCardOpen(false)}
            onCenterOnTrain={handleLocateTrain}
          />
        </div>

        {/* Fullscreen Map Canvas */}
        <div className="flex-1 w-full min-h-[calc(100vh-140px)] relative">
          <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />
        </div>

        {/* Bottom Status Legend */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/95 dark:bg-[#0b1528]/95 backdrop-blur-md border border-sky-200 dark:border-sky-800/80 px-3 py-2 rounded-xl text-[10px] font-mono text-slate-700 dark:text-slate-300 shadow-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-5 border-t-[3px] border-sky-500" /> {t('map_planned_corridor', 'Planned train corridor')}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> {t('map_live_loco_beacon', 'Live RTIS locomotive beacon')}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f9fc] dark:bg-[#070c18] flex items-center justify-center font-mono text-sm text-[#1e293b] dark:text-slate-100">Loading Live Corridor Map...</div>}>
      <MapContent />
    </Suspense>
  );
}
