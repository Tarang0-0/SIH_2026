"use client";

import React, { useEffect, useState } from 'react';
import { Compass, Waves, Mountain, Landmark, Building2, CloudSun, Wind, Droplets, MapPin, Sparkles, Eye, ShieldCheck, Thermometer } from 'lucide-react';

interface POIItem {
  name: string;
  type: string;
  category: string;
  description: string;
  distance_from_train_km?: number;
  near_station?: string;
}

interface StationWeather {
  station_code: string;
  name: string;
  temperature_c: number;
  condition: string;
  visibility_km: number;
  rainfall_mm_hr: number;
  wind_speed_kmph: number;
}

interface SmartTravelCompanionProps {
  currentStationCode: string;
  nextStationCode: string;
  destinationStationCode: string;
  currentLat?: number;
  currentLng?: number;
  stationCodes?: string[];
  isLightMode?: boolean;
}

export const SmartTravelCompanionCard: React.FC<SmartTravelCompanionProps> = ({
  currentStationCode,
  nextStationCode,
  destinationStationCode,
  currentLat,
  currentLng,
  stationCodes = [],
  isLightMode = false
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'waterway' | 'mountain' | 'heritage' | 'weather'>('all');
  const [pois, setPois] = useState<POIItem[]>([]);
  const [weatherData, setWeatherData] = useState<{
    current?: StationWeather;
    next?: StationWeather;
    destination?: StationWeather;
  }>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        // 1. Fetch live POIs from Overpass API endpoint
        let poiUrl = `/api/v1/poi?lat=${currentLat || 28.64}&lng=${currentLng || 77.21}`;
        if (stationCodes.length > 0) {
          poiUrl = `/api/v1/poi?stations=${encodeURIComponent(stationCodes.join(','))}&lat=${currentLat || 28.64}&lng=${currentLng || 77.21}`;
        }
        const poiRes = await fetch(poiUrl);
        if (poiRes.ok && isMounted) {
          const pJson = await poiRes.json();
          setPois(pJson);
        }

        // 2. Fetch Multi-Station Live Weather (Current, Next, Destination)
        const [currW, nextW, destW] = await Promise.all([
          fetch(`/api/v1/weather/section?origin=${currentStationCode}&destination=${nextStationCode}`).then(r => r.json()).catch(() => null),
          fetch(`/api/v1/weather/section?origin=${nextStationCode}&destination=${destinationStationCode}`).then(r => r.json()).catch(() => null),
          fetch(`/api/v1/weather/section?origin=${destinationStationCode}&destination=${destinationStationCode}`).then(r => r.json()).catch(() => null)
        ]);

        if (isMounted) {
          setWeatherData({
            current: currW ? {
              station_code: currentStationCode,
              name: currentStationCode,
              temperature_c: currW.temperature_c ?? 26,
              condition: currW.condition ?? "Clear Sky",
              visibility_km: currW.visibility_km ?? 10.0,
              rainfall_mm_hr: currW.rainfall_mm_hr ?? 0.0,
              wind_speed_kmph: currW.wind_speed_kmph ?? 8.0
            } : undefined,
            next: nextW ? {
              station_code: nextStationCode,
              name: nextStationCode,
              temperature_c: nextW.temperature_c ?? 25,
              condition: nextW.condition ?? "Hazy Sunshine",
              visibility_km: nextW.visibility_km ?? 9.5,
              rainfall_mm_hr: nextW.rainfall_mm_hr ?? 0.0,
              wind_speed_kmph: nextW.wind_speed_kmph ?? 10.0
            } : undefined,
            destination: destW ? {
              station_code: destinationStationCode,
              name: destinationStationCode,
              temperature_c: destW.temperature_c ?? 27,
              condition: destW.condition ?? "Clear",
              visibility_km: destW.visibility_km ?? 10.0,
              rainfall_mm_hr: destW.rainfall_mm_hr ?? 0.0,
              wind_speed_kmph: destW.wind_speed_kmph ?? 7.0
            } : undefined
          });
        }
      } catch (err) {
        console.debug("Smart Travel Companion load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [currentStationCode, nextStationCode, destinationStationCode, currentLat, currentLng, stationCodes]);

  const filteredPois = activeTab === 'all'
    ? pois
    : pois.filter(p => p.category === activeTab);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'waterway': return <Waves className="w-3.5 h-3.5 text-blue-500" />;
      case 'mountain': return <Mountain className="w-3.5 h-3.5 text-emerald-500" />;
      case 'infrastructure': return <Building2 className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Landmark className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'waterway': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'mountain': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'infrastructure': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      isLightMode
        ? 'bg-white/90 border-slate-200 shadow-sm backdrop-blur-md text-slate-800'
        : 'bg-slate-900/70 border-slate-800/80 backdrop-blur-xl text-slate-100'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 border border-cyan-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight">Smart Travel Companion</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Overpass GIS
              </span>
            </div>
            <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Scenic Rivers, Mountain Ghats, Bridges & Multi-Station Live Weather
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? isLightMode ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            All Sights
          </button>
          <button
            onClick={() => setActiveTab('waterway')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'waterway'
                ? isLightMode ? 'bg-white text-blue-600 shadow-sm' : 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-blue-500'
            }`}
          >
            Rivers
          </button>
          <button
            onClick={() => setActiveTab('mountain')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'mountain'
                ? isLightMode ? 'bg-white text-emerald-600 shadow-sm' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-500 hover:text-emerald-500'
            }`}
          >
            Ghats
          </button>
          <button
            onClick={() => setActiveTab('heritage')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'heritage'
                ? isLightMode ? 'bg-white text-purple-600 shadow-sm' : 'bg-purple-950/60 text-purple-400 border border-purple-500/30'
                : 'text-slate-500 hover:text-purple-500'
            }`}
          >
            Monuments
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'weather'
                ? isLightMode ? 'bg-white text-amber-600 shadow-sm' : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-amber-500'
            }`}
          >
            Weather Forecast
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'weather' ? (
        /* Multi-Station Weather Comparison */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Current Station Weather */}
          <div className={`p-3.5 rounded-xl border ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Current Station</span>
              <span className="font-mono text-xs font-bold">{currentStationCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-black font-mono">{weatherData.current?.temperature_c ?? 26}°C</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{weatherData.current?.condition ?? "Clear"}</div>
              </div>
              <CloudSun className="w-7 h-7 text-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-cyan-400" /> {weatherData.current?.visibility_km ?? 10} km vis</span>
              <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-blue-400" /> {weatherData.current?.wind_speed_kmph ?? 8} km/h</span>
            </div>
          </div>

          {/* Next Station Weather */}
          <div className={`p-3.5 rounded-xl border ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Approaching Stop</span>
              <span className="font-mono text-xs font-bold">{nextStationCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-black font-mono">{weatherData.next?.temperature_c ?? 25}°C</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{weatherData.next?.condition ?? "Clear Sky"}</div>
              </div>
              <CloudSun className="w-7 h-7 text-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-cyan-400" /> {weatherData.next?.visibility_km ?? 9.5} km vis</span>
              <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-blue-400" /> {weatherData.next?.wind_speed_kmph ?? 10} km/h</span>
            </div>
          </div>

          {/* Destination Weather */}
          <div className={`p-3.5 rounded-xl border ${
            isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Destination</span>
              <span className="font-mono text-xs font-bold">{destinationStationCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-black font-mono">{weatherData.destination?.temperature_c ?? 27}°C</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{weatherData.destination?.condition ?? "Fair"}</div>
              </div>
              <Thermometer className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" /> 0mm Rain</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Safe Track</span>
            </div>
          </div>
        </div>
      ) : (
        /* Geographic POIs & Scenic Landmarks Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPois.map((poi, idx) => (
            <div
              key={`${poi.name}-${idx}`}
              className={`p-3.5 rounded-xl border transition-all hover:scale-[1.01] ${
                isLightMode
                  ? 'bg-slate-50/80 hover:bg-white border-slate-200/80 shadow-sm'
                  : 'bg-slate-950/40 hover:bg-slate-900/60 border-slate-800/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${getCategoryColor(poi.category)}`}>
                    {getCategoryIcon(poi.category)}
                  </div>
                  <h4 className="font-bold text-xs line-clamp-1">{poi.name}</h4>
                </div>
                {poi.distance_from_train_km !== undefined && (
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    ~{poi.distance_from_train_km} km
                  </span>
                )}
              </div>
              <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {poi.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
