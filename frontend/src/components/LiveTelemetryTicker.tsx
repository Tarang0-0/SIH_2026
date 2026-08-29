"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Radio, Train, Gauge, Sparkles, Navigation, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface LiveTelemetryTickerProps {
  trainNumber: string;
  currentStation: string;
  nextStation: string;
  speedKmph: number;
  delayMinutes: number;
  isLightMode?: boolean;
}

export function LiveTelemetryTicker({
  trainNumber,
  currentStation,
  nextStation,
  speedKmph,
  delayMinutes,
  isLightMode = false
}: LiveTelemetryTickerProps) {
  const [events, setEvents] = useState<Array<{ id: number; time: string; message: string; tag: string; type: 'speed' | 'signal' | 'ml' | 'gps' }>>([]);
  const [activeEventIndex, setActiveEventIndex] = useState<number>(0);

  // Generate dynamic live telemetry stream
  useEffect(() => {
    const now = new Date();
    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const initialEvents = [
      {
        id: 1,
        time: formatTime(new Date(now.getTime() - 24000)),
        message: `Train ${trainNumber} cleared ${currentStation} junction switchboard at ${speedKmph} km/h`,
        tag: "GPS TELEMETRY",
        type: "gps" as const
      },
      {
        id: 2,
        time: formatTime(new Date(now.getTime() - 16000)),
        message: `Section Automatic Block Signalling: Green Wave clearance active toward ${nextStation}`,
        tag: "SIGNALLING",
        type: "signal" as const
      },
      {
        id: 3,
        time: formatTime(new Date(now.getTime() - 8000)),
        message: `Cascading 20-Feature GBDT Engine: Projected delay delta: ${delayMinutes <= 0 ? '0.0 min (On Time)' : `+${delayMinutes}m`}`,
        tag: "AI INFERENCE",
        type: "ml" as const
      },
      {
        id: 4,
        time: formatTime(now),
        message: `Real-time loco traction speed: ${speedKmph} km/h · Next halt: ${nextStation}`,
        tag: "TRACTION KINEMATICS",
        type: "speed" as const
      }
    ];

    setEvents(initialEvents);

    // Rotate active telemetry event every 4 seconds
    const interval = setInterval(() => {
      setActiveEventIndex(prev => (prev + 1) % 4);
    }, 4000);

    return () => clearInterval(interval);
  }, [trainNumber, currentStation, nextStation, speedKmph, delayMinutes]);

  const activeEvent = events[activeEventIndex] || events[0];
  if (!activeEvent) return null;

  return (
    <div className={`w-full rounded-2xl px-4 py-2.5 border flex items-center justify-between gap-3 text-xs font-mono transition-all overflow-hidden ${
      isLightMode
        ? 'bg-white/85 border-slate-200 text-slate-700 shadow-sm'
        : 'glass-panel border-cyan-500/20 bg-[#0b1220]/90 text-slate-300'
    }`}>
      {/* Left Pulse Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
          isLightMode ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
        }`}>
          {activeEvent.tag}
        </span>
      </div>

      {/* Center Dynamic Message */}
      <div className="flex-1 truncate flex items-center gap-2">
        <span className="text-[10px] text-slate-400 font-bold shrink-0">{activeEvent.time}</span>
        <span className="text-slate-400">·</span>
        <span className={`truncate font-semibold ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
          {activeEvent.message}
        </span>
      </div>

      {/* Right Engine Status */}
      <div className="hidden sm:flex items-center gap-2 text-[10px] shrink-0">
        <span className="text-emerald-500 font-bold flex items-center gap-1">
          <Zap className="w-3 h-3 text-emerald-500 animate-pulse" />
          GBDT ACTIVE
        </span>
      </div>
    </div>
  );
}
