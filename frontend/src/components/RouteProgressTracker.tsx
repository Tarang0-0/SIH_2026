"use client";

import React, { useRef } from 'react';
import { RouteStationTopology, StationETA } from '../types/raileta';
import { MapPin, CheckCircle2, Clock, Navigation, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { formatRemainingTime } from './StationETATable';

interface RouteProgressTrackerProps {
  topology: RouteStationTopology[];
  currentStationCode: string;
  predictions?: StationETA[];
  selectedStationCode?: string;
  onSelectStation?: (stationCode: string) => void;
  isLightMode?: boolean;
}

export default function RouteProgressTracker({
  topology = [],
  currentStationCode,
  predictions = [],
  selectedStationCode,
  onSelectStation,
  isLightMode = false
}: RouteProgressTrackerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (topology.length === 0) return null;

  const currentIndex = topology.findIndex(s => s.station_code === currentStationCode);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const progressPercent = Math.round((safeCurrentIndex / (topology.length - 1)) * 100);

  const predMap = new Map<string, StationETA>();
  predictions.forEach(p => predMap.set(p.station_code, p));

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString.slice(11, 16);
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return "";
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className={`rounded-3xl p-5 sm:p-6 border space-y-4 transition-all ${
      isLightMode
        ? 'bg-white/90 border-slate-200 text-slate-800 shadow-sm backdrop-blur-md'
        : 'glass-panel border-white/10 text-white'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-500" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider">
            Interactive Route Timeline & Station Halts
          </h3>
          <span className={`text-[10px] font-mono hidden md:inline ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            · Click any station below to calculate ETA & remaining travel time
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded-xl border font-bold ${
            isLightMode
              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
          }`}>
            {progressPercent}% Traversed
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className={`p-1 rounded-lg border transition-colors ${
                isLightMode
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className={`p-1 rounded-lg border transition-colors ${
                isLightMode
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Track Line with Interactive Cards */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto pb-3 pt-2 custom-scrollbar scroll-smooth"
      >
        <div className="flex items-stretch gap-3 min-w-max px-1">
          {topology.map((stn, idx) => {
            const isCurrent = stn.station_code === currentStationCode;
            const isPassed = idx < safeCurrentIndex;
            const isUpcoming = idx >= safeCurrentIndex;
            const isTarget = stn.station_code === selectedStationCode;
            const pred = predMap.get(stn.station_code);
            const remainingTime = isUpcoming && pred ? formatRemainingTime(pred.predicted_eta) : null;

            return (
              <div
                key={stn.station_code}
                onClick={() => onSelectStation && onSelectStation(stn.station_code)}
                className={`relative flex flex-col justify-between p-3.5 rounded-2xl cursor-pointer transition-all min-w-[155px] max-w-[180px] border ${
                  isTarget
                    ? isLightMode
                      ? 'bg-emerald-50/90 border-emerald-400 shadow-md ring-2 ring-emerald-400/30'
                      : 'glass-panel-active border-emerald-400/80 bg-gradient-to-b from-emerald-950/40 to-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400/30'
                    : isCurrent
                    ? isLightMode
                      ? 'bg-cyan-50/90 border-cyan-400 shadow-sm'
                      : 'border-cyan-400/60 bg-gradient-to-b from-cyan-950/40 to-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : isPassed
                    ? isLightMode
                      ? 'bg-slate-50 border-slate-200 opacity-70 hover:opacity-100'
                      : 'bg-slate-900/40 border-white/5 opacity-70 hover:opacity-100'
                    : isLightMode
                    ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                    : 'glass-card border-white/10 hover:border-cyan-500/40 hover:bg-slate-900/80'
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    isTarget
                      ? isLightMode ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCurrent
                      ? isLightMode ? 'bg-cyan-100 text-cyan-800 border-cyan-300 animate-pulse' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                      : isPassed
                      ? isLightMode ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-slate-800 text-slate-400 border-slate-700'
                      : isLightMode ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {isTarget ? 'TARGET DEST' : isCurrent ? 'CURRENT LOC' : isPassed ? 'PASSED' : `HALT #${idx + 1}`}
                  </span>

                  {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {isTarget && <Target className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
                </div>

                {/* Station Identifiers */}
                <div className="my-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-extrabold">
                      {stn.station_code}
                    </span>
                    <span className={`text-[11px] font-mono ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {stn.distance_km} km
                    </span>
                  </div>
                  <div className={`text-xs font-semibold truncate max-w-[145px] ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`} title={stn.station_name}>
                    {stn.station_name}
                  </div>
                </div>

                {/* Remaining Time & Predicted ETA */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/5 space-y-1">
                  {isUpcoming && pred ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className={isLightMode ? 'text-slate-500' : 'text-slate-400'}>ETA:</span>
                        <span className="text-emerald-600 dark:text-emerald-300 font-bold">
                          {formatTime(pred.predicted_eta)}
                        </span>
                      </div>

                      {remainingTime && (
                        <div className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                          isLightMode
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{remainingTime}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Sched:</span>
                      <span>{stn.scheduled_arrival.slice(0, 5)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
