"use client";

import React from 'react';
import { Sparkles, MapPin, CheckCircle, Clock } from 'lucide-react';

export interface StationETA {
  station_code: string;
  station_name: string;
  sequence_number: number;
  distance_km: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  baseline_eta: string;
  predicted_eta: string;
  predicted_delay_minutes: number;
  confidence_range_lower: string;
  confidence_range_upper: string;
  lower_bound_minutes: number;
  upper_bound_minutes: number;
  model_version: string;
  data_source: string;
}

interface StationETATableProps {
  predictions?: StationETA[];
  loading?: boolean;
  selectedStationCode?: string;
  onSelectStation?: (stationCode: string) => void;
  isLightMode?: boolean;
}

export function formatRemainingTime(isoString?: string): string {
  if (!isoString) return "--";
  try {
    const target = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return "Arrived / Due now";
    
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      return `${minutes} min left`;
    }
    return `${hours}h ${minutes}m left`;
  } catch {
    return "--";
  }
}

export default function StationETATable({
  predictions = [],
  loading = false,
  selectedStationCode,
  onSelectStation,
  isLightMode = false
}: StationETATableProps) {
  const formatTime = (isoString: string) => {
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString;
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-500" />
          <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
            Station-by-Station Dynamic ETA Forecast
          </h3>
          <span className={`text-[10px] font-mono hidden sm:inline ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            (Click any station to calculate exact time remaining)
          </span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
          isLightMode ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        }`}>
          Cascading GBDT Engine
        </span>
      </div>

      <div className={`overflow-x-auto rounded-2xl border shadow-lg ${
        isLightMode ? 'bg-white border-slate-200 divide-slate-100' : 'bg-slate-950/60 border-white/10'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`uppercase text-[10px] font-mono tracking-wider border-b ${
            isLightMode ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900/80 border-white/10 text-slate-400'
          }`}>
            <tr>
              <th className="p-3.5">Station</th>
              <th className="p-3.5 text-cyan-600 dark:text-cyan-300 font-bold">Time Remaining</th>
              <th className="p-3.5">Scheduled</th>
              <th className="p-3.5 text-emerald-600 dark:text-emerald-400 font-bold">Dynamic Expected ETA</th>
              <th className="p-3.5">Predicted Delay</th>
              <th className="p-3.5">80% Confidence Window</th>
            </tr>
          </thead>
          <tbody className={`divide-y font-mono ${
            isLightMode ? 'divide-slate-100 text-slate-700' : 'divide-white/5 text-slate-200'
          }`}>
            {predictions && predictions.length > 0 ? (
              predictions.map((p) => {
                const isSelected = p.station_code === selectedStationCode;
                const remaining = formatRemainingTime(p.predicted_eta);

                return (
                  <tr 
                    key={p.station_code} 
                    onClick={() => onSelectStation && onSelectStation(p.station_code)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? isLightMode ? 'bg-emerald-50 font-bold text-emerald-950' : 'bg-emerald-500/15 font-bold text-white'
                        : isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="p-3.5 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                      <span className="font-bold">{p.station_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'
                      }`}>
                        {p.station_code}
                      </span>
                      {isSelected && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          isLightMode ? 'bg-emerald-200 text-emerald-900' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          TARGET DEST 🎯
                        </span>
                      )}
                    </td>

                    {/* Dedicated Time Remaining Column */}
                    <td className="p-3.5">
                      <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                        isLightMode
                          ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
                          : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>{remaining}</span>
                      </div>
                    </td>

                    <td className={`p-3.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.scheduled_arrival}</td>
                    
                    <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatTime(p.predicted_eta)}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        p.predicted_delay_minutes <= 0
                          ? isLightMode ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/10 text-emerald-400'
                          : isLightMode ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {p.predicted_delay_minutes <= 0 ? 'On Time' : `+${p.predicted_delay_minutes} min`}
                      </span>
                    </td>

                    <td className={`p-3.5 text-[11px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {formatTime(p.confidence_range_lower)} – {formatTime(p.confidence_range_upper)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-mono text-xs">
                  {loading ? "Calculating dynamic machine learning ETA predictions..." : "No station predictions available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
