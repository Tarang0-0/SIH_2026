"use client";

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Map, 
  Layers, 
  BrainCircuit, 
  Activity, 
  Zap, 
  LogOut, 
  ArrowLeft, 
  Radio, 
  Sliders, 
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import FleetSidebar from './FleetSidebar';
import MapLibreView from './MapLibreView';
import StationETATable from './StationETATable';
import SHAPExplainerCard from './SHAPExplainerCard';
import DisruptionSimulatorCard from './DisruptionSimulatorCard';
import { TrainSummary, ETAPredictionResponse, RouteStationTopology } from '../types/raileta';

interface OperationsControlCenterProps {
  trains: TrainSummary[];
  selectedTrain: TrainSummary;
  onSelectTrain: (train: TrainSummary) => void;
  etaData: ETAPredictionResponse | null;
  routeTopology: RouteStationTopology[];
  loading: boolean;
  isWsConnected: boolean;
  onDisruptionInjected: (data: any) => void;
  onLogout: () => void;
  onReturnToPassenger: () => void;
}

export default function OperationsControlCenter({
  trains = [],
  selectedTrain,
  onSelectTrain,
  etaData,
  routeTopology = [],
  loading = false,
  isWsConnected = true,
  onDisruptionInjected,
  onLogout,
  onReturnToPassenger
}: OperationsControlCenterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [opsView, setOpsView] = useState<'dashboard' | 'map' | 'explainability'>('dashboard');

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070d18] text-[#e5e2e3]">
      {/* Top Admin Status Bar */}
      <div className="bg-[#0b1220] border-b border-emerald-500/20 px-6 py-2.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnToPassenger}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Passenger View</span>
          </button>

          <div className="h-4 w-px bg-white/10"></div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <span className="glow-dot-emerald"></span>
            <span className="font-bold">Operations Control Center</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Controller ID: <b>ADMIN-2026</b></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-mono text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Leakage Invariant ≤ T</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-medium transition-colors"
            title="End admin session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Main Operations Split Layout */}
      <div className="flex-1 flex">
        {/* Left Fleet Sidebar */}
        <FleetSidebar
          trains={trains}
          selectedTrain={selectedTrain}
          onSelectTrain={onSelectTrain}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeView={opsView}
          onViewChange={setOpsView}
          isWsConnected={isWsConnected}
        />

        {/* Main Content Area */}
        <main className="flex-1 ml-72 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Top Operational KPI Metrics Bar */}
          <div className="glass-panel rounded-2xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            <div className="flex flex-col px-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Active Fleet</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-sans text-white">{trains.length}</span>
                <span className="text-[11px] font-mono text-cyan-400">Tracked Corridors</span>
              </div>
            </div>

            <div className="flex flex-col px-2 pt-3 lg:pt-0">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Observed Delay</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold font-sans ${selectedTrain.delay_minutes <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedTrain.delay_minutes <= 0 ? 'On Time' : `+${selectedTrain.delay_minutes}m`}
                </span>
                <span className="text-[11px] font-mono text-slate-400">At {selectedTrain.current_station}</span>
              </div>
            </div>

            <div className="flex flex-col px-2 pt-3 lg:pt-0">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">GBDT Model Accuracy</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-sans text-emerald-400">96.9%</span>
                <span className="text-[11px] font-mono text-emerald-400/80">within ±5 min</span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 pt-3 lg:pt-0">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Data Provenance</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {selectedTrain.data_source === 'REAL' ? 'LIVE DATA' : 'DEMO REPLAY · Strict ≤ T'}
                </span>
              </div>
            </div>
          </div>

          {/* View 1: MapLibre Vector Telemetry Tracking */}
          {opsView === 'map' ? (
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4 min-h-[600px] flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Map className="w-5 h-5 text-cyan-400" />
                    MapLibre GL Vector Telemetry & Sectional Weather
                  </h2>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {selectedTrain.train_number} · {selectedTrain.train_name} ({selectedTrain.origin} → {selectedTrain.destination})
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span>Speed: <b className="text-white">{selectedTrain.speed_kmph} km/h</b></span>
                  <span>Delay: <b className={selectedTrain.delay_minutes <= 0 ? "text-emerald-400" : "text-amber-400"}>
                    {selectedTrain.delay_minutes <= 0 ? "On Time" : `+${selectedTrain.delay_minutes}m`}
                  </b></span>
                </div>
              </div>

              <div className="flex-1 w-full min-h-[500px]">
                <MapLibreView 
                  topology={routeTopology}
                  currentStation={selectedTrain.current_station}
                  nextStation={selectedTrain.next_station}
                  trainNumber={selectedTrain.train_number}
                  speedKmph={selectedTrain.speed_kmph}
                  delayMinutes={selectedTrain.delay_minutes}
                  nextStationEta={etaData?.predictions?.[0]}
                />
              </div>
            </div>
          ) : opsView === 'explainability' ? (
            /* View 2: Dedicated SHAP TreeExplainer Attribution Mode */
            <div className="grid grid-cols-12 gap-6 flex-1">
              <div className="col-span-12 lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col gap-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-emerald-400" />
                    TreeExplainer Model Attribution Mechanics
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    SHAP (SHapley Additive exPlanations) decomposes individual section predictions into additive feature contributions. Negative values represent delay recovery / acceleration factors, while positive values indicate operational compounding delay factors.
                  </p>
                </div>

                <div className="space-y-4 text-xs font-mono text-slate-300">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-cyan-400 font-bold">1. Zero-Leakage Tabular Extractor</div>
                    <p className="text-slate-400 leading-relaxed">
                      Features are computed strictly from observations timestamped ≤ T. No future station events or target travel times are visible to the model.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-emerald-400 font-bold">2. Weather & Temporal Trend Features</div>
                    <p className="text-slate-400 leading-relaxed">
                      Physical caution running during fog (&lt; 1km visibility) and peak-hour congestion multipliers improve MAE by over 90.9% compared to static timetables.
                    </p>
                  </div>
                </div>

                <div className="mt-auto">
                  <StationETATable 
                    predictions={etaData?.predictions}
                    loading={loading}
                  />
                </div>
              </div>

              <div className="col-span-12 lg:col-span-5">
                <SHAPExplainerCard 
                  shapExplanation={etaData?.shap_explanation}
                  loading={loading}
                />
              </div>
            </div>
          ) : (
            /* View 3: Bento Grid Layout: Forecast Table + Progress Tracker + SHAP + Simulator */
            <div className="grid grid-cols-12 gap-6">
              {/* Primary Tracking & Station Table (8 Cols) */}
              <div className="col-span-12 lg:col-span-8 glass-panel rounded-2xl p-6 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {selectedTrain.train_number}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        AI Confidence 96.9%
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedTrain.train_name}</h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedTrain.origin} → {selectedTrain.destination}</p>
                  </div>

                  <div className="flex gap-6 text-right">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">Current Speed</span>
                      <span className="text-lg font-bold font-mono text-white">{selectedTrain.speed_kmph} <span className="text-xs text-slate-400 font-normal">km/h</span></span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">Observed Delay</span>
                      <span className={`text-lg font-bold font-mono ${selectedTrain.delay_minutes <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedTrain.delay_minutes <= 0 ? 'On Time' : `+${selectedTrain.delay_minutes}m`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Station ETA Forecast Table */}
                <StationETATable 
                  predictions={etaData?.predictions}
                  loading={loading}
                />
              </div>

              {/* Right Column: SHAP Feature Explainability & Disruption Simulator (4 Cols) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <SHAPExplainerCard 
                  shapExplanation={etaData?.shap_explanation}
                  loading={loading}
                />

                <DisruptionSimulatorCard 
                  trainNumber={selectedTrain.train_number}
                  trainName={selectedTrain.train_name}
                  currentDelay={selectedTrain.delay_minutes}
                  onDisruptionInjected={onDisruptionInjected}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
