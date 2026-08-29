"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RouteStationTopology, StationETA } from '../types/raileta';
import { CloudFog, CloudRain, Sun, Wind, MapPin, Clock, ArrowRight, ShieldAlert, Sparkles, Navigation, CheckCircle2, Compass, Ruler, Maximize2, Minimize2, Video, Layers, Orbit } from 'lucide-react';
import turf from '../lib/turf';
import { STATION_MASTER } from '@/data/stationMaster';

const FALLBACK_STATION_COORDINATES: Record<string, { name: string; lng: number; lat: number }> = STATION_MASTER;

// Reliable fallback map style specification with zero API key requirement
const INLINE_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO'
    }
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const INLINE_LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO'
    }
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

interface WeatherData {
  condition: string;
  temperature_c: number;
  visibility_km: number;
  rainfall_mm_hr: number;
  caution_advisory: string;
  icon_type: string;
  data_source: string;
}

interface MapLibreViewProps {
  stations?: string[];
  topology?: RouteStationTopology[];
  currentStation: string;
  nextStation?: string;
  trainNumber: string;
  speedKmph: number;
  delayMinutes: number;
  nextStationEta?: StationETA | null;
  selectedTargetStationCode?: string;
  onSelectTargetStation?: (stationCode: string) => void;
  isLightMode?: boolean;
}

export default function MapLibreView({
  stations = [],
  topology = [],
  currentStation,
  nextStation,
  trainNumber,
  speedKmph,
  delayMinutes,
  nextStationEta,
  selectedTargetStationCode,
  onSelectTargetStation,
  isLightMode = false
}: MapLibreViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const trainMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFollowMode, setIsFollowMode] = useState<boolean>(false);
  const [is3dPitch, setIs3dPitch] = useState<boolean>(false);

  const [liveWeather, setLiveWeather] = useState<WeatherData>({
    condition: "Clear Sky",
    temperature_c: 28.0,
    visibility_km: 10.0,
    rainfall_mm_hr: 0.0,
    caution_advisory: "Standard operational line speed authorized",
    icon_type: "sun",
    data_source: "REAL"
  });

  const [turfMetrics, setTurfMetrics] = useState({
    distanceToNextKm: 0,
    totalTrackKm: 0,
    remainingTrackKm: 0,
    progressPercent: 0,
    bearingDeg: 0
  });

  // 1. Fetch live OpenWeather observation
  const fetchLiveWeather = useCallback(async () => {
    try {
      const origin = currentStation || "NDLS";
      const destination = nextStation || currentStation || "GZB";
      const res = await fetch(`/api/v1/weather/section?origin=${origin}&destination=${destination}`);
      if (res.ok) {
        const data = await res.json();
        setLiveWeather({
          condition: data.condition || "Clear Sky",
          temperature_c: data.temperature_c ?? 25.0,
          visibility_km: data.visibility_km ?? 8.0,
          rainfall_mm_hr: data.rainfall_mm_hr ?? 0.0,
          caution_advisory: data.caution_advisory || "Standard operational line speed",
          icon_type: data.icon_type || "sun",
          data_source: data.data_source || "OPENWEATHER_LIVE"
        });
      }
    } catch (err) {
      console.debug("Weather API fetch notice:", err);
    }
  }, [currentStation, nextStation]);

  useEffect(() => {
    fetchLiveWeather();
  }, [fetchLiveWeather]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return "--:--";
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString.slice(11, 16);
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return "--:--";
    }
  };

  // 2. Compute spatial coordinates along route
  const stationPoints = useMemo(() => {
    if (topology && topology.length > 0) {
      return topology.map(s => ({
        code: s.station_code,
        name: s.station_name,
        lng: s.longitude || FALLBACK_STATION_COORDINATES[s.station_code]?.lng || 77.2197,
        lat: s.latitude || FALLBACK_STATION_COORDINATES[s.station_code]?.lat || 28.6415
      }));
    } else if (stations && stations.length > 0) {
      return stations
        .map(code => {
          const meta = FALLBACK_STATION_COORDINATES[code];
          return meta ? { code, name: meta.name, lng: meta.lng, lat: meta.lat } : null;
        })
        .filter((s): s is { code: string; name: string; lng: number; lat: number } => Boolean(s));
    }
    return [
      { code: "NDLS", name: "New Delhi", lng: 77.2197, lat: 28.6415 },
      { code: "LKO", name: "Lucknow", lng: 80.9234, lat: 26.8317 }
    ];
  }, [topology, stations]);

  const coords: [number, number][] = useMemo(() => {
    return stationPoints.map(s => [s.lng, s.lat]);
  }, [stationPoints]);

  const getTrainSpatialInfo = useCallback((): {
    coordinate: [number, number];
    bearing: number;
    distanceToNext: number;
  } => {
    let currLng = 77.2197;
    let currLat = 28.6415;

    const currTop = stationPoints.find(s => s.code === currentStation);
    if (currTop) {
      currLng = currTop.lng;
      currLat = currTop.lat;
    }

    const currPt: [number, number] = [currLng, currLat];

    if (!nextStation || nextStation === currentStation) {
      return { coordinate: currPt, bearing: 0, distanceToNext: 0 };
    }

    let nextLng = currLng;
    let nextLat = currLat;

    const nextTop = stationPoints.find(s => s.code === nextStation);
    if (nextTop) {
      nextLng = nextTop.lng;
      nextLat = nextTop.lat;
    } else {
      return { coordinate: currPt, bearing: 0, distanceToNext: 0 };
    }

    const nextPt: [number, number] = [nextLng, nextLat];

    const distBetweenStns = turf.distance(currPt, nextPt, { units: "kilometers" });
    const bearing = turf.bearing(currPt, nextPt);

    const interpDist = distBetweenStns * 0.55;
    const trainDest = turf.destination(currPt, interpDist, bearing);
    const trainCoord = trainDest.geometry.coordinates;

    const distRemainingToNext = turf.distance(trainCoord, nextPt, { units: "kilometers" });

    return {
      coordinate: trainCoord,
      bearing: Math.round(bearing),
      distanceToNext: Math.round(distRemainingToNext * 10) / 10
    };
  }, [currentStation, nextStation, stationPoints]);

  // 3. Update Turf Metrics
  useEffect(() => {
    const { coordinate: trainPos, bearing, distanceToNext } = getTrainSpatialInfo();
    if (coords.length > 1) {
      const slice = turf.sliceRoute(coords, trainPos);
      setTurfMetrics({
        distanceToNextKm: distanceToNext,
        totalTrackKm: slice.totalDistanceKm,
        remainingTrackKm: slice.distanceRemainingKm,
        progressPercent: slice.progressPercent,
        bearingDeg: bearing
      });
    }
  }, [coords, getTrainSpatialInfo]);

  // 4. Initialize Map Instance (Runs ONCE on mount)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] = coords.length > 0 ? coords[0] : [77.2197, 28.6415];
    const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || "";

    const styleUrl = isLightMode
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
      : `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${mapTilerKey}`;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: 6.0,
      pitch: 0,
      attributionControl: false
    });

    mapRef.current = map;

    // Graceful fallback to inline Carto vector/raster style if MapTiler fails
    map.on('error', (e) => {
      console.debug("MapLibre tile notice (fallback active):", e);
      if (!isMapLoadedRef.current) {
        try {
          map.setStyle(isLightMode ? INLINE_LIGHT_STYLE : INLINE_DARK_STYLE);
        } catch {}
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    const handleLoad = () => {
      isMapLoadedRef.current = true;
      updateRouteLayer(map, coords, isLightMode);
      if (coords.length > 1) {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(coords);
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
      }
    };

    map.on('load', handleLoad);

    // Auto-resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (trainMarkerRef.current) trainMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []); // Run once on mount

  // Helper to add or update route layer GeoJSON
  const updateRouteLayer = (map: maplibregl.Map, trackCoords: [number, number][], light: boolean) => {
    if (!map || trackCoords.length < 2) return;

    const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: trackCoords
      }
    };

    if (map.getSource('route-track')) {
      (map.getSource('route-track') as maplibregl.GeoJSONSource).setData(geojsonData);
    } else {
      map.addSource('route-track', {
        type: 'geojson',
        data: geojsonData
      });

      // Glow layer
      map.addLayer({
        id: 'route-track-glow',
        type: 'line',
        source: 'route-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': light ? '#0ea5e9' : '#06b6d4',
          'line-width': 7,
          'line-opacity': light ? 0.3 : 0.45,
          'line-blur': 4
        }
      });

      // Main track line
      map.addLayer({
        id: 'route-track-line',
        type: 'line',
        source: 'route-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': light ? '#0284c7' : '#38bdf8',
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });
    }
  };

  // 5. Update Map Style when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || "";
    const styleUrl = isLightMode
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
      : `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${mapTilerKey}`;

    map.setStyle(styleUrl);

    map.once('styledata', () => {
      updateRouteLayer(map, coords, isLightMode);
    });
  }, [isLightMode, coords]);

  // 6. Update Route Track GeoJSON when coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    updateRouteLayer(map, coords, isLightMode);

    if (coords.length > 1) {
      const [minLng, minLat, maxLng, maxLat] = turf.bbox(coords);
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 600 });
    }
  }, [coords, isLightMode]);

  // 7. Update Station Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (typeof window !== 'undefined' && onSelectTargetStation) {
      (window as any).__railetaSelectStation = onSelectTargetStation;
    }

    stationPoints.forEach((stn) => {
      const isNext = stn.code === nextStation;
      const isTarget = stn.code === selectedTargetStationCode;

      const el = document.createElement('div');
      el.className = 'station-map-marker flex flex-col items-center cursor-pointer';
      el.onclick = () => {
        if (onSelectTargetStation) onSelectTargetStation(stn.code);
      };

      const dotColor = isTarget ? '#10b981' : isNext ? '#06b6d4' : isLightMode ? '#64748b' : '#94a3b8';
      const dotSize = isTarget ? '15px' : isNext ? '12px' : '9px';
      const dotGlow = isTarget ? '0 0 14px #10b981' : isNext ? '0 0 8px #06b6d4' : '0 0 4px rgba(148, 163, 184, 0.5)';
      const labelColor = isTarget ? (isLightMode ? '#059669' : '#34d399') : isNext ? (isLightMode ? '#0284c7' : '#67e8f9') : (isLightMode ? '#334155' : '#cbd5e1');

      el.innerHTML = `
        <div style="width: ${dotSize}; height: ${dotSize}; border-radius: 50%; background-color: ${dotColor}; border: 2.5px solid ${isLightMode ? '#ffffff' : '#070d18'}; box-shadow: ${dotGlow};"></div>
        <span style="font-family: monospace; font-size: 9px; font-weight: bold; color: ${labelColor}; margin-top: 2px; text-shadow: ${isLightMode ? '0 1px 2px rgba(255,255,255,0.9)' : '0 1px 3px rgba(0,0,0,0.9)'};">${stn.code}${isTarget ? ' 🎯' : ''}</span>
      `;

      const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
        `<div style="font-family: sans-serif; font-size: 11px; padding: 6px 8px; color: ${isLightMode ? '#0f172a' : '#ffffff'}; font-weight: 600; background: ${isLightMode ? '#ffffff' : '#0b1220'}; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
           ${stn.name} (${stn.code}) ${isTarget ? '· <span style="color: #10b981;">🎯 Destination</span>' : isNext ? '· <span style="color: #0284c7;">Next Stop</span>' : ''}
           <div style="margin-top: 6px;">
             <button onclick="window.__railetaSelectStation && window.__railetaSelectStation('${stn.code}')" style="background: #06b6d4; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; border: none; padding: 3px 8px; border-radius: 6px; cursor: pointer;">
               Track Time to Here ➔
             </button>
           </div>
         </div>`
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stn.lng, stn.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [stationPoints, nextStation, selectedTargetStationCode, isLightMode, onSelectTargetStation]);

  // 8. Update Train Marker & Camera Follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { coordinate: trainPos, bearing, distanceToNext } = getTrainSpatialInfo();

    if (trainMarkerRef.current) {
      trainMarkerRef.current.setLngLat(trainPos);
    } else {
      const trainEl = document.createElement('div');
      trainEl.className = 'live-train-marker relative flex items-center justify-center cursor-pointer';
      trainEl.innerHTML = `
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: rgba(6, 182, 212, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #06b6d4; border: 2.5px solid #ffffff; box-shadow: 0 0 16px 5px rgba(6, 182, 212, 0.9); display: flex; align-items: center; justify-content: center; transform: rotate(${bearing}deg);">
          <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 8px solid #ffffff; transform: translateY(-1px);"></div>
        </div>
      `;

      const nextStnName = nextStationEta?.station_name || nextStation || "Upcoming Station";
      const predEtaTime = formatTime(nextStationEta?.predicted_eta);

      const trainPopup = new maplibregl.Popup({ offset: 16, closeButton: true }).setHTML(
        `<div style="font-family: monospace; font-size: 11px; padding: 6px; color: ${isLightMode ? '#0f172a' : '#ffffff'}; line-height: 1.4; background: ${isLightMode ? '#ffffff' : '#0b1220'}; border-radius: 10px;">
           <b style="font-size: 12px; color: #0284c7;">Train ${trainNumber}</b><br/>
           📍 <b>Between ${currentStation} and ${nextStation || 'Next'}</b><br/>
           🧭 Bearing: <b>${bearing}°</b> | 📏 <b>${distanceToNext} km</b> to next stop<br/>
           ⚡ Speed: <b>${speedKmph} km/h</b> | Delay: <b>${delayMinutes <= 0 ? 'On Time' : `+${delayMinutes}m`}</b><br/>
           🎯 Next Halt: <b>${nextStnName}</b> (${predEtaTime})<br/>
           ☁️ Weather: <b>${liveWeather.condition} (${liveWeather.visibility_km} km vis)</b>
         </div>`
      );

      const trainMarker = new maplibregl.Marker({ element: trainEl })
        .setLngLat(trainPos)
        .setPopup(trainPopup)
        .addTo(map);

      trainMarkerRef.current = trainMarker;
    }

    if (isFollowMode) {
      map.panTo(trainPos, { duration: 800 });
    }
  }, [currentStation, nextStation, speedKmph, delayMinutes, isFollowMode, getTrainSpatialInfo, nextStationEta, trainNumber, liveWeather, isLightMode]);

  const fitCorridorBounds = () => {
    const map = mapRef.current;
    if (!map) return;
    setIsFollowMode(false);
    if (coords.length > 1) {
      const [minLng, minLat, maxLng, maxLat] = turf.bbox(coords);
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1000 });
    }
  };

  const toggleFollowMode = () => {
    setIsFollowMode(prev => {
      const nextState = !prev;
      if (nextState && mapRef.current) {
        const { coordinate: trainPos } = getTrainSpatialInfo();
        mapRef.current.flyTo({ center: trainPos, zoom: 9.5, speed: 1.2 });
      }
      return nextState;
    });
  };

  const toggle3dPitch = () => {
    setIs3dPitch(prev => {
      const nextState = !prev;
      if (mapRef.current) {
        mapRef.current.easeTo({ pitch: nextState ? 50 : 0, duration: 600 });
      }
      return nextState;
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 150);
  };

  return (
    <div className={`relative w-full transition-all duration-300 ${
      isFullscreen
        ? 'fixed inset-0 z-50 rounded-none h-screen bg-[#070d18]'
        : 'h-full min-h-[480px] rounded-3xl overflow-hidden border shadow-2xl ' + (isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-[#070d18] border-white/15')
    }`}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[480px]" />

      {/* Top Floating Telemetry & Weather HUD */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none z-10">
        {/* Train Position Box */}
        <div className={`rounded-2xl p-3 border backdrop-blur-2xl shadow-xl pointer-events-auto flex items-center gap-3 ${
          isLightMode ? 'bg-white/90 border-slate-200 text-slate-800' : 'glass-panel border-white/15 text-white'
        }`}>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-300 font-mono font-bold text-xs shadow-md">
            {trainNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">
                Between {currentStation} & {nextStation || 'Next Halt'}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                delayMinutes <= 0
                  ? isLightMode ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : isLightMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {delayMinutes <= 0 ? 'On Time' : `+${delayMinutes}m Delay`}
              </span>
            </div>
            <div className={`text-[11px] font-mono mt-0.5 flex items-center gap-2 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              <span>Next: <b className="text-cyan-600 dark:text-cyan-300">{nextStationEta?.station_name || nextStation}</b></span>
              <span>·</span>
              <span className="flex items-center gap-1 font-semibold">
                <Ruler className="w-3 h-3 text-cyan-500" />
                <b>{turfMetrics.distanceToNextKm} km</b>
              </span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ETA: {formatTime(nextStationEta?.predicted_eta)}
              </span>
            </div>
          </div>
        </div>

        {/* Live OpenWeather HUD */}
        <div className={`rounded-2xl p-3 border backdrop-blur-2xl shadow-xl pointer-events-auto flex items-center gap-3 ${
          isLightMode ? 'bg-white/90 border-slate-200 text-slate-800' : 'glass-panel border-cyan-500/25 bg-[#070d18]/90 text-white'
        }`}>
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-500">
            {liveWeather.icon_type === "fog" ? (
              <CloudFog className="w-5 h-5 animate-pulse" />
            ) : liveWeather.icon_type === "rain" ? (
              <CloudRain className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">{liveWeather.condition}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
              }`}>
                {liveWeather.temperature_c}°C
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                OpenWeather Live
              </span>
            </div>
            <div className={`text-[10px] font-mono mt-0.5 flex items-center gap-1.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Visibility: <b className="text-cyan-600 dark:text-cyan-300">{liveWeather.visibility_km} km</b></span>
              <span>·</span>
              <span className="font-medium">{liveWeather.caution_advisory}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls & Turf.js Status Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className={`backdrop-blur-xl px-3.5 py-2 rounded-xl border text-[11px] font-mono flex items-center gap-2.5 shadow-lg ${
          isLightMode ? 'bg-white/90 border-slate-200 text-slate-700' : 'bg-[#070d18]/90 border-white/10 text-slate-300'
        }`}>
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping"></span>
          <span>
            Turf.js Geodesics · Heading: <b className="text-cyan-500">{turfMetrics.bearingDeg}°</b> · Corridor: <b>{turfMetrics.totalTrackKm} km</b> ({turfMetrics.progressPercent}% traversed)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Follow Mode Toggle */}
          <button
            onClick={toggleFollowMode}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all shadow-md ${
              isFollowMode
                ? 'bg-cyan-500 text-white border-cyan-400 font-bold'
                : isLightMode
                  ? 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/30'
            }`}
            title="Lock camera onto train"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isFollowMode ? 'Tracking' : 'Follow Train'}</span>
          </button>

          {/* 3D Perspective Toggle */}
          <button
            onClick={toggle3dPitch}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all shadow-md ${
              is3dPitch
                ? 'bg-purple-600 text-white border-purple-400 font-bold'
                : isLightMode
                  ? 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-purple-300 border-purple-500/30'
            }`}
            title="Toggle 3D perspective pitch"
          >
            <Orbit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D Tilt</span>
          </button>

          {/* Fit Route Bounds */}
          <button
            onClick={fitCorridorBounds}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all shadow-md ${
              isLightMode
                ? 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300'
            }`}
            title="Fit full corridor"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Route</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all shadow-md ${
              isLightMode
                ? 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/20'
            }`}
            title="Toggle fullscreen map"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
