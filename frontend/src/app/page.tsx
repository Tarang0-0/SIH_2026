"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { 
  ShieldCheck, 
  Map as MapIcon, 
  Layers, 
  BrainCircuit, 
  Activity, 
  Clock, 
  Zap, 
  Sparkles,
  ArrowRight,
  Search,
  Train,
  CheckCircle2,
  AlertCircle,
  Radio,
  Gauge,
  MapPin,
  RefreshCw,
  Lock,
  Unlock,
  Target,
  Sliders,
  Compass,
  SlidersHorizontal,
  ChevronRight,
  Sun,
  Moon,
  Share2,
  Mountain,
  Waves
} from 'lucide-react';

import MapLibreView from '../components/MapLibreView';
import StationETATable from '../components/StationETATable';
import SHAPExplainerCard from '../components/SHAPExplainerCard';
import RouteProgressTracker from '../components/RouteProgressTracker';
import DisruptionSimulatorCard from '../components/DisruptionSimulatorCard';
import TrainSearchBar from '../components/TrainSearchBar';
import PassengerHeroCard from '../components/PassengerHeroCard';
import { ElevationProfileCard } from '../components/ElevationProfileCard';
import { SmartTravelCompanionCard } from '../components/SmartTravelCompanionCard';
import { LiveTelemetryTicker } from '../components/LiveTelemetryTicker';
import AdminLoginModal from '../components/AdminLoginModal';
import { HeroCardSkeleton, RouteTrackerSkeleton, TableSkeleton } from '../components/SkeletonLoader';
import { useLiveTrainWebSocket } from '../hooks/useLiveTrainWebSocket';
import { TrainSummary, ETAPredictionResponse, RouteStationTopology } from '../types/raileta';

const QUICK_FLAGSHIP_CHIPS = [
  { number: "12004", name: "Lucknow Shatabdi", tag: "⚡ Shatabdi" },
  { number: "12951", name: "Mumbai Rajdhani", tag: "🚆 Rajdhani" },
  { number: "22436", name: "Vande Bharat Express", tag: "⚡ Vande Bharat" },
  { number: "12301", name: "Howrah Rajdhani", tag: "🚆 Rajdhani" },
  { number: "12626", name: "Kerala Express", tag: "🚆 Superfast" }
];

function RailETADashboardContent() {
  const [trains, setTrains] = useState<TrainSummary[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<TrainSummary | null>(null);
  const [selectedTargetStation, setSelectedTargetStation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'passenger' | 'advanced'>('passenger');
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [etaData, setEtaData] = useState<ETAPredictionResponse | null>(null);
  const [routeTopology, setRouteTopology] = useState<RouteStationTopology[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [etaUpdateNotification, setEtaUpdateNotification] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(60);

  // Sync theme & admin authentication state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem("raileta_theme");
      if (savedTheme === "light") {
        setIsLightMode(true);
      }

      const savedAuth = localStorage.getItem("raileta_admin_auth");
      if (savedAuth === "true") {
        setIsAdminAuthenticated(true);
      }

      const params = new URLSearchParams(window.location.search);
      const urlTrain = params.get('train');
      if (urlTrain) {
        setSelectedTrain(prev => prev ? ({ ...prev, train_number: urlTrain }) : null);
      }
      const urlStation = params.get('station');
      if (urlStation) {
        setSelectedTargetStation(urlStation);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem("raileta_theme", next ? "light" : "dark");
      }
      return next;
    });
  };

  // Update URL search params when selectedTrain or targetStation changes
  const updateUrlState = useCallback((trainNum: string, targetStation?: string) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('train', trainNum);
      if (targetStation) {
        url.searchParams.set('station', targetStation);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Fetch active fleet dynamically from REST API
  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/trains`);
      if (res.ok) {
        const data: TrainSummary[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTrains(data);
          setSelectedTrain(prev => {
            if (!prev) return data[0];
            const match = data.find(t => t.train_number === prev.train_number);
            return match || data[0];
          });
        }
      }
    } catch (err) {
      console.debug("Fleet API fetch notice:", err);
    }
  }, []);

  // Fetch route topology for the selected train
  const fetchRoute = useCallback(async (trainNumber: string) => {
    try {
      const res = await fetch(`/api/v1/trains/${trainNumber}/route`);
      if (res.ok) {
        const data = await res.json();
        const stations = data.stations || [];
        setRouteTopology(stations);

        if (stations.length > 0) {
          setSelectedTargetStation(prev => {
            if (prev && stations.some((s: any) => s.station_code === prev)) return prev;
            return stations[stations.length - 1]?.station_code || "";
          });
        }
      }
    } catch (err) {
      console.debug("Failed to fetch route topology:", err);
    }
  }, []);

  // Fetch dynamic ETA prediction from REST API
  const fetchETA = useCallback(async (trainNumber: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/trains/${trainNumber}/eta`);
      if (res.ok) {
        const data: ETAPredictionResponse = await res.json();
        setEtaData(data);
        if (data.predictions && data.predictions.length > 0) {
          setSelectedTargetStation(prev => {
            if (prev && data.predictions.some(p => p.station_code === prev)) return prev;
            return data.predictions[data.predictions.length - 1]?.station_code || "";
          });
        }
      }
    } catch (err) {
      console.debug("Failed to fetch dynamic ETA prediction:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    if (selectedTrain?.train_number) {
      fetchRoute(selectedTrain.train_number);
      fetchETA(selectedTrain.train_number);
      updateUrlState(selectedTrain.train_number, selectedTargetStation);
    }
  }, [selectedTrain?.train_number, fetchRoute, fetchETA, updateUrlState, selectedTargetStation]);

  // Auto-refresh live polling interval (1 minute / 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          if (selectedTrain?.train_number) {
            fetchETA(selectedTrain.train_number);
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedTrain?.train_number, fetchETA]);

  // Handle incoming live prediction updates from WebSocket
  const handleWsMessage = useCallback((predictionData: any) => {
    if (predictionData && selectedTrain) {
      const payload: ETAPredictionResponse = predictionData.data || predictionData;
      if (payload.journey_id === selectedTrain.journey_id || payload.train_number === selectedTrain.train_number) {
        setEtaData(payload);
        
        setSelectedTrain(prev => {
          if (!prev) return null;
          return {
            ...prev,
            current_station: payload.current_station_code || prev.current_station,
            next_station: payload.next_station_code || prev.next_station,
            speed_kmph: payload.current_speed_kmph ?? prev.speed_kmph,
            delay_minutes: payload.current_delay_minutes ?? prev.delay_minutes
          };
        });

        setEtaUpdateNotification(`Live ETA updated for ${payload.train_number} (${payload.current_station_code} → ${payload.next_station_code})`);
        setTimeout(() => setEtaUpdateNotification(null), 4000);
      }
    }
  }, [selectedTrain]);

  const { isConnected } = useLiveTrainWebSocket({
    journeyId: selectedTrain?.journey_id || "J1001",
    onMessage: handleWsMessage
  });

  const handleDisruptionInjected = useCallback((updatedPrediction: any) => {
    if (updatedPrediction) {
      const payload = updatedPrediction.data || updatedPrediction.prediction || updatedPrediction;
      setEtaData(payload);
      setSelectedTrain(prev => {
        if (!prev) return null;
        return {
          ...prev,
          current_station: payload.current_station_code || prev.current_station,
          next_station: payload.next_station_code || prev.next_station,
          speed_kmph: payload.current_speed_kmph ?? prev.speed_kmph,
          delay_minutes: payload.current_delay_minutes ?? prev.delay_minutes
        };
      });
      setEtaUpdateNotification(`Disruption applied! Recalculated downstream ETAs across ${payload.predictions?.length || 0} stations.`);
      setTimeout(() => setEtaUpdateNotification(null), 5000);
    }
  }, []);

  const handleSelectTrain = (train: TrainSummary) => {
    setSelectedTrain(train);
    setSelectedTargetStation("");
    updateUrlState(train.train_number);
  };

  const handleSelectTargetStation = (stationCode: string) => {
    setSelectedTargetStation(stationCode);
    if (selectedTrain?.train_number) {
      updateUrlState(selectedTrain.train_number, stationCode);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem("raileta_admin_auth", "true");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem("raileta_admin_auth");
    }
  };

  const activeTrain = selectedTrain || trains[0];
  
  const filteredTrains = useMemo(() => {
    return trains.filter(t => {
      const matchesSearch = 
        t.train_number.includes(searchTerm) ||
        t.train_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.current_station.toLowerCase().includes(searchTerm.toLowerCase());

      if (selectedCategory === 'All') return matchesSearch;
      if (selectedCategory === 'Rajdhani') return matchesSearch && (t.train_type?.toLowerCase().includes('rajdhani') || t.train_name.toLowerCase().includes('rajdhani'));
      if (selectedCategory === 'Shatabdi') return matchesSearch && (t.train_type?.toLowerCase().includes('shatabdi') || t.train_name.toLowerCase().includes('shatabdi'));
      if (selectedCategory === 'Vande Bharat') return matchesSearch && (t.train_type?.toLowerCase().includes('vande') || t.train_name.toLowerCase().includes('vande'));
      if (selectedCategory === 'Superfast') return matchesSearch && (t.train_type?.toLowerCase().includes('superfast') || t.train_type?.toLowerCase().includes('express'));
      return matchesSearch;
    });
  }, [trains, searchTerm, selectedCategory]);

  const stationCodesList = useMemo(() => {
    if (routeTopology.length > 0) return routeTopology.map(s => s.station_code);
    if (etaData?.predictions && etaData.predictions.length > 0) return etaData.predictions.map(p => p.station_code);
    return [];
  }, [routeTopology, etaData]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isLightMode 
        ? 'bg-[#f8fafc] text-slate-900 selection:bg-cyan-500/20' 
        : 'bg-[#070d18] text-[#dde2f3] selection:bg-cyan-500/30'
    }`}>
      
      {/* ========================================================
          TOP UNIFIED HEADER BAR (Apple Maps Style)
         ======================================================== */}
      <header className={`sticky top-0 z-50 px-4 sm:px-6 py-3 transition-colors border-b backdrop-blur-2xl ${
        isLightMode
          ? 'bg-white/85 border-slate-200 shadow-sm'
          : 'bg-[#070d18]/95 border-white/10'
      }`}>
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-md">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight font-sans">
                  Rail<span className="text-cyan-500">ETA</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300">
                  SIH 26028
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20" title="Connected to RailRadar Live Telemetry Provider">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>RAILRADAR LIVE API</span>
                </div>
              </div>
              <p className={`text-[11px] font-mono hidden sm:block ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                RailRadar Live Telemetry · Dynamic GBDT Forecast · Zero Data Leakage
              </p>
            </div>
          </div>

          {/* Central Train Search Bar with Recent Searches & Favourites */}
          <div className="flex-1 max-w-2xl">
            <TrainSearchBar 
              onSelectTrain={handleSelectTrain}
              selectedTrainNumber={activeTrain?.train_number}
              isLightMode={isLightMode}
            />
          </div>

          {/* Right Controls & Mode Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* View Mode Switcher */}
            <div className={`p-1 rounded-2xl flex items-center gap-1 text-xs font-mono border ${
              isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-white/10'
            }`}>
              <button
                onClick={() => setActiveTab('passenger')}
                className={`px-3 py-1.5 rounded-xl transition-all font-bold ${
                  activeTab === 'passenger'
                    ? isLightMode ? 'bg-white text-cyan-700 shadow-sm border border-slate-200' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Passenger View
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-3 py-1.5 rounded-xl transition-all font-bold flex items-center gap-1.5 ${
                  activeTab === 'advanced'
                    ? isLightMode ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                AI Insights & Simulator
              </button>
            </div>

            {/* Apple Maps Light/Dark Theme Switcher */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all ${
                isLightMode 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' 
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
              title={isLightMode ? "Switch to Midnight Dark Theme" : "Switch to Apple Maps Light Theme"}
            >
              {isLightMode ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Refresh Countdown Pill */}
            <button
              onClick={() => {
                fetchFleet();
                if (activeTrain?.train_number) fetchETA(activeTrain.train_number);
                setRefreshCountdown(60);
              }}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                isLightMode
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
              title="Auto-refreshes every 1 min (60s). Click to refresh now."
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
              <span className="font-bold text-[11px]">{refreshCountdown}s</span>
            </button>

            {isAdminAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-xl hidden lg:flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Controller Session</span>
                </span>
                <button
                  onClick={handleAdminLogout}
                  className="text-xs font-mono text-rose-500 hover:text-rose-600 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 transition-all"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className={`text-xs font-mono px-3 py-1.5 rounded-xl border transition-all hidden sm:flex items-center gap-1.5 ${
                  isLightMode
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Login</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Accessible Live Broadcast Toast */}
      {etaUpdateNotification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="glass-panel border border-cyan-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 bg-[#070d18]/95 backdrop-blur-2xl">
            <span className="glow-dot-cyan"></span>
            <span className="text-xs font-mono text-cyan-200">{etaUpdateNotification}</span>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Quick Flagship Suggestion Chips Banner */}
      <div className={`px-4 sm:px-6 py-2 border-b text-xs font-mono transition-colors ${
        isLightMode ? 'bg-slate-100/80 border-slate-200 text-slate-600' : 'bg-[#0b1220]/80 border-white/5 text-slate-400'
      }`}>
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-semibold">
              <Zap className="w-3.5 h-3.5 text-cyan-500" />
              Quick Select Train:
            </span>
            {QUICK_FLAGSHIP_CHIPS.map(chip => (
              <button
                key={chip.number}
                onClick={() => {
                  const match = trains.find(t => t.train_number === chip.number);
                  if (match) handleSelectTrain(match);
                  else fetchETA(chip.number);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                  activeTrain?.train_number === chip.number
                    ? isLightMode
                      ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold shadow-sm'
                      : 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/50 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : isLightMode
                      ? 'bg-white hover:bg-slate-200/60 text-slate-700 border border-slate-200'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                }`}
              >
                <span>{chip.number}</span>
                <span className="opacity-75">({chip.name})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className={isConnected ? "glow-dot-emerald" : "glow-dot-amber"}></span>
              <span>WebSocket: <b className="font-bold">{isConnected ? "Live Stream" : "Connecting"}</b></span>
            </div>
            <div>Model: <b className="text-cyan-500 font-bold">20-Feature GBDT</b></div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MAIN WORKSPACE LAYOUT (2-COLUMN INTEGRATED DASHBOARD)
         ======================================================== */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ----------------------------------------------------
            LEFT COLUMN: FLEET EXPLORER & QUICK SELECTOR (4 Cols)
           ---------------------------------------------------- */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Fleet Header & Filters */}
          <div className={`p-4 rounded-3xl space-y-3 border transition-all ${
            isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-white/10'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 ${
                isLightMode ? 'text-slate-800' : 'text-slate-300'
              }`}>
                <Layers className="w-4 h-4 text-cyan-500" />
                Active Indian Railways Fleet ({filteredTrains.length})
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                isLightMode ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                Live Fleet
              </span>
            </div>

            {/* Quick Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['All', 'Rajdhani', 'Shatabdi', 'Vande Bharat', 'Superfast'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-xl transition-all ${
                    selectedCategory === cat 
                      ? isLightMode
                        ? 'bg-cyan-500 text-white font-bold shadow-sm'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' 
                      : isLightMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Filter Search Input */}
            <div className="relative pt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Filter fleet by name or station..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-xl py-2 pl-9 pr-3 text-xs font-mono focus:outline-none transition-colors border ${
                  isLightMode
                    ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500'
                    : 'bg-slate-900/90 border-white/10 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50'
                }`}
              />
            </div>
          </div>

          {/* Scrollable Train Cards List */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 custom-scrollbar">
            {filteredTrains.map((train) => {
              const isSelected = activeTrain?.journey_id === train.journey_id || activeTrain?.train_number === train.train_number;
              const isDelay = train.delay_minutes > 0;

              return (
                <div
                  key={train.journey_id || train.train_number}
                  onClick={() => handleSelectTrain(train)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    isSelected 
                      ? isLightMode
                        ? 'bg-cyan-50/80 border-cyan-400 shadow-md ring-1 ring-cyan-400/30'
                        : 'glass-panel-active border-cyan-500/50 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 shadow-lg ring-1 ring-cyan-500/30' 
                      : isLightMode
                        ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                        : 'glass-card hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                        isLightMode
                          ? 'bg-cyan-100 text-cyan-800 border-cyan-300'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {train.train_number}
                      </span>
                      <span className={`text-[10px] font-mono truncate max-w-[120px] ${
                        isLightMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {train.train_type || 'Express'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${!isDelay ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      <span className={`text-[11px] font-mono font-bold ${
                        !isDelay 
                          ? isLightMode ? 'text-emerald-700' : 'text-emerald-400'
                          : isLightMode ? 'text-amber-700' : 'text-amber-400'
                      }`}>
                        {!isDelay ? 'On Time' : `+${train.delay_minutes}m Late`}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold truncate mt-2">{train.train_name}</h4>
                  
                  <div className={`flex items-center justify-between text-[11px] mt-1 ${
                    isLightMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1">
                      <span>{train.origin}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{train.destination}</span>
                    </span>
                    <span className="font-mono font-semibold">{train.speed_kmph} km/h</span>
                  </div>

                  <div className={`flex items-center justify-between text-[10px] font-mono pt-2 mt-2 border-t ${
                    isLightMode ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
                  }`}>
                    <span>At: <b className="text-cyan-500 font-bold">{train.current_station}</b></span>
                    <span>Next: <b className="font-bold">{train.next_station}</b></span>
                  </div>
                </div>
              );
            })}

            {filteredTrains.length === 0 && (
              <div className="text-center py-12 rounded-2xl text-slate-500 font-mono text-xs border border-dashed border-slate-300 dark:border-slate-800">
                No trains match "{searchTerm}". Try another train number or name.
              </div>
            )}
          </div>

        </aside>

        {/* ----------------------------------------------------
            RIGHT COLUMN: ACTIVE TRAIN INTELLIGENCE & FORECAST (8 Cols)
           ---------------------------------------------------- */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* Live Dynamic Telemetry & Signalling Ticker */}
          {activeTrain && (
            <LiveTelemetryTicker 
              trainNumber={activeTrain.train_number}
              currentStation={activeTrain.current_station}
              nextStation={activeTrain.next_station}
              speedKmph={activeTrain.speed_kmph}
              delayMinutes={activeTrain.delay_minutes}
              isLightMode={isLightMode}
            />
          )}

          {/* Passenger Dynamic ETA Hero Card (Answers "How much time to reach my station?") */}
          {activeTrain ? (
            <PassengerHeroCard 
              train={activeTrain}
              topology={routeTopology}
              predictions={etaData?.predictions || []}
              selectedTargetStationCode={selectedTargetStation}
              onSelectTargetStation={handleSelectTargetStation}
              lastUpdated={etaData?.last_update_timestamp ? new Date(etaData.last_update_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined}
              loading={loading}
              shapExplanation={etaData?.shap_explanation || {}}
              isLightMode={isLightMode}
              refreshCountdown={refreshCountdown}
              onManualRefresh={() => {
                if (activeTrain?.train_number) fetchETA(activeTrain.train_number);
                setRefreshCountdown(60);
              }}
            />
          ) : (
            <HeroCardSkeleton />
          )}

          {/* Interactive Route Timeline & Halts with Clickable Station Cards */}
          {routeTopology.length > 0 && activeTrain && (
            <RouteProgressTracker 
              topology={routeTopology}
              currentStationCode={activeTrain.current_station}
              predictions={etaData?.predictions || []}
              selectedStationCode={selectedTargetStation}
              onSelectStation={handleSelectTargetStation}
              isLightMode={isLightMode}
            />
          )}

          {/* Live Interactive MapLibre GL Vector Map */}
          {activeTrain && (
            <div className="h-[460px] w-full rounded-3xl overflow-hidden shadow-2xl">
              <MapLibreView 
                stations={etaData?.predictions?.map(p => p.station_code) || []}
                topology={routeTopology}
                currentStation={activeTrain.current_station}
                nextStation={activeTrain.next_station}
                trainNumber={activeTrain.train_number}
                speedKmph={activeTrain.speed_kmph}
                delayMinutes={activeTrain.delay_minutes}
                nextStationEta={etaData?.predictions?.[0] || null}
                selectedTargetStationCode={selectedTargetStation}
                onSelectTargetStation={handleSelectTargetStation}
                isLightMode={isLightMode}
              />
            </div>
          )}

          {/* Feature 4: Smart Travel Companion (Scenic Sights, Rivers, Ghats, Bridges, Multi-Station Weather via Overpass API) */}
          {activeTrain && (
            <SmartTravelCompanionCard 
              currentStationCode={activeTrain.current_station}
              nextStationCode={activeTrain.next_station || activeTrain.current_station}
              destinationStationCode={selectedTargetStation || activeTrain.destination}
              stationCodes={stationCodesList}
              isLightMode={isLightMode}
            />
          )}

          {/* Feature 3: OpenTopography SRTM DEM Elevation Profile Chart */}
          {stationCodesList.length > 0 && (
            <ElevationProfileCard 
              stationCodes={stationCodesList}
              currentStationCode={activeTrain?.current_station}
              isLightMode={isLightMode}
            />
          )}

          {/* Station ETA Prediction Table (Core Deliverable with Remaining Time Column) */}
          <div className={`p-6 rounded-3xl border space-y-4 transition-all ${
            isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-white/10'
          }`}>
            <StationETATable 
              predictions={etaData?.predictions || []}
              loading={loading}
              selectedStationCode={selectedTargetStation}
              onSelectStation={handleSelectTargetStation}
              isLightMode={isLightMode}
            />
          </div>

          {/* Advanced Mode: SHAP Explainability and What-If Disruption Simulator */}
          {activeTab === 'advanced' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              
              {/* SHAP TreeExplainer Feature Contribution Card */}
              <div className={`p-6 rounded-3xl border flex flex-col justify-between ${
                isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-white/10'
              }`}>
                <SHAPExplainerCard 
                  shapExplanation={etaData?.shap_explanation || {}}
                  loading={loading}
                />
              </div>

              {/* What-If Disruption Simulator */}
              {activeTrain && (
                <div className={`p-6 rounded-3xl border flex flex-col justify-between ${
                  isLightMode ? 'bg-amber-50/60 border-amber-200 shadow-sm' : 'glass-panel border-amber-500/20 bg-amber-500/5'
                }`}>
                  <DisruptionSimulatorCard 
                    trainNumber={activeTrain.train_number}
                    trainName={activeTrain.train_name}
                    currentDelay={activeTrain.delay_minutes}
                    onDisruptionInjected={handleDisruptionInjected}
                  />
                </div>
              )}

            </div>
          )}

        </section>

      </main>

      {/* Minimalist Footer */}
      <footer className={`border-t py-6 px-4 text-center text-xs font-mono transition-colors ${
        isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#070d18] border-white/10 text-slate-500'
      }`}>
        <div>
          RailETA — Expected Time of Arrival Forecasting Engine · Smart India Hackathon 2026 (Problem Statement 26028)
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Powered by Next.js App Router · FastAPI Async · Real RailRadar Telemetry · MapTiler 3D Vector Cartography · OpenWeather Live · OpenTopography SRTM DEM · OpenStreetMap Overpass GIS · Turf.js Geodesics
        </div>
      </footer>

    </div>
  );
}

export default function HomeDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070d18] flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-sm animate-pulse flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
          <span>Loading RailETA Dynamic Engine...</span>
        </div>
      </div>
    }>
      <RailETADashboardContent />
    </Suspense>
  );
}
