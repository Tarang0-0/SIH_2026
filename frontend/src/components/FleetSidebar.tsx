"use client";

import React from 'react';
import { Search, Layers, BrainCircuit, Map, Radio, ArrowRight } from 'lucide-react';
import { TrainSummary } from '../types/raileta';

interface FleetSidebarProps {
  trains: TrainSummary[];
  selectedTrain: TrainSummary;
  onSelectTrain: (train: TrainSummary) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeView: 'dashboard' | 'map' | 'explainability';
  onViewChange: (view: 'dashboard' | 'map' | 'explainability') => void;
  isWsConnected?: boolean;
}

export default function FleetSidebar({
  trains = [],
  selectedTrain,
  onSelectTrain,
  searchTerm,
  onSearchChange,
  activeView,
  onViewChange,
  isWsConnected = true
}: FleetSidebarProps) {
  const filteredTrains = trains.filter(t => 
    t.train_number.includes(searchTerm) || 
    t.train_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-72 bg-[#0b1220]/80 backdrop-blur-2xl border-r border-white/10 p-4 flex flex-col gap-4 fixed top-16 bottom-0 left-0 z-40">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text"
          placeholder="Filter fleet..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-900/90 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      {/* Active Train Fleet List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Active Fleet ({filteredTrains.length})
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className={isWsConnected ? "glow-dot-emerald" : "glow-dot-amber"}></span>
            <span>{isWsConnected ? "Live WS" : "Offline"}</span>
          </div>
        </div>

        {filteredTrains.map((train) => {
          const isSelected = selectedTrain?.journey_id === train.journey_id;
          const isDelay = train.delay_minutes > 0;

          return (
            <div
              key={train.journey_id}
              onClick={() => onSelectTrain(train)}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all ${
                isSelected ? 'glass-panel-active border-cyan-500/40' : 'glass-card'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {train.train_number}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={!isDelay ? "glow-dot-emerald" : "glow-dot-amber"}></span>
                  <span className={`text-[10px] font-mono font-medium ${
                    !isDelay ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {!isDelay ? 'On Time' : `+${train.delay_minutes}m`}
                  </span>
                </div>
              </div>

              <h4 className="text-xs font-semibold text-white truncate mt-1.5">{train.train_name}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span>{train.origin}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span>{train.destination}</span>
              </p>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 mt-2 border-t border-white/5">
                <span>Speed: <span className="text-slate-200">{train.speed_kmph} km/h</span></span>
                <span>Loc: <span className="text-cyan-300 font-bold">{train.current_station}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation View Toggles for Operations Mode */}
      <div className="pt-3 border-t border-white/10 flex flex-col gap-1 text-xs font-mono">
        <button 
          onClick={() => onViewChange("dashboard")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
            activeView === "dashboard" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold" : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Forecast & Analytics</span>
        </button>

        <button 
          onClick={() => onViewChange("map")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
            activeView === "map" ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold" : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Map className="w-4 h-4" />
          <span>MapLibre Vector Map</span>
        </button>

        <button 
          onClick={() => onViewChange("explainability")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
            activeView === "explainability" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold" : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>SHAP TreeExplainer</span>
        </button>
      </div>
    </aside>
  );
}
