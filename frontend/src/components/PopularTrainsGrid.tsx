"use client";

import React, { useState } from 'react';
import { ArrowRight, Train, Sparkles, MapPin, Zap, Radio } from 'lucide-react';
import { TrainSummary } from '../types/raileta';

interface PopularTrainsGridProps {
  trains: TrainSummary[];
  onSelectTrain: (train: TrainSummary) => void;
  selectedTrainNumber?: string;
}

export default function PopularTrainsGrid({
  trains = [],
  onSelectTrain,
  selectedTrainNumber
}: PopularTrainsGridProps) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const categories = ["ALL", "Vande Bharat", "Rajdhani", "Shatabdi", "Superfast"];

  const filteredTrains = trains.filter(t => {
    if (filterType === "ALL") return true;
    return t.train_type?.toLowerCase().includes(filterType.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            Live Active Indian Railways Fleet ({filteredTrains.length})
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterType(cat)}
              className={`px-3 py-1 rounded-xl transition-all ${
                filterType === cat
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              {cat === "ALL" ? "All Corridors" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Corridors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrains.map((train) => {
          const isSelected = train.train_number === selectedTrainNumber;
          const isDelay = train.delay_minutes > 0;

          return (
            <div
              key={train.journey_id || train.train_number}
              onClick={() => onSelectTrain(train)}
              className={`p-5 rounded-3xl cursor-pointer transition-all flex flex-col justify-between border ${
                isSelected
                  ? 'glass-panel-active border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : 'glass-card hover:border-cyan-500/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/30">
                      {train.train_number}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {train.train_type || 'Express'}
                    </span>
                  </div>

                  <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    !isDelay
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}>
                    {!isDelay ? 'On Time' : `+${train.delay_minutes}m Late`}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">
                  {train.train_name}
                </h3>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-2">
                  <span className="text-slate-300 font-semibold">{train.origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300 font-semibold">{train.destination}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>At <b>{train.current_station}</b> · {train.speed_kmph} km/h</span>
                </span>

                <span className="text-cyan-400 font-bold hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  <span>Track Live</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
