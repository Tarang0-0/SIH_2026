'use client';

import React, { useState } from 'react';
import TiltCard from './TiltCard';

interface StationInfo {
  code: string;
  name: string;
  sched: string;
  pred?: string;
  delay?: number;
  status?: string;
}

interface ThreeDRouteVisualizerProps {
  trainNumber: string;
  trainName: string;
  origin: string;
  destination: string;
  stations?: StationInfo[];
  currentSpeed?: number | null;
  delayMinutes?: number;
  progressPercent?: number;
  telemetryLabel?: string;
}

export default function ThreeDRouteVisualizer({
  trainNumber,
  trainName,
  origin,
  destination,
  stations = [],
  currentSpeed = null,
  delayMinutes = 0,
  progressPercent = 0,
  telemetryLabel = 'LIVE STATUS',
}: ThreeDRouteVisualizerProps) {
  const [activeStationIndex, setActiveStationIndex] = useState<number | null>(null);

  // Take up to 5 representative nodes from the API response.
  const displayNodes = stations.length > 0
    ? [
        stations[0],
        ...(stations.length >= 3 ? [
          stations[Math.floor(stations.length * 0.25)],
          stations[Math.floor(stations.length * 0.5)],
          stations[Math.floor(stations.length * 0.75)],
        ] : []),
        stations[stations.length - 1],
      ]
    : [];

  const isDelayed = delayMinutes > 0;

  return (
    <TiltCard
      maxTilt={6}
      perspective={1200}
      className="surface-3d p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden"
    >
      {/* 3D Atmospheric Background Lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Top HUD bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-white/[0.08] relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              LIVE CORRIDOR TELEMETRY
            </span>
            <span className="text-xs text-slate-400 font-mono">{telemetryLabel}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-mono">
              {trainNumber}
            </h3>
            <span className="text-slate-300 font-medium text-sm md:text-base">{trainName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-2 text-right font-mono">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Speed</div>
            <div className="text-lg font-bold text-white flex items-center gap-1">
              <span className="text-cyan-400">{currentSpeed !== null ? currentSpeed : 'N/A'}</span>
              <span className="text-xs text-slate-500">km/h</span>
            </div>
          </div>
          <div className={`border rounded-2xl px-4 py-2 font-mono ${
            isDelayed
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <div className="text-[11px] uppercase tracking-wider font-semibold">Status</div>
            <div className="text-lg font-bold">
              {isDelayed ? `+${delayMinutes}m Late` : 'On Time'}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Isometric Rail Track Stage */}
      <div className="relative my-10 py-6 px-2">
        {/* Isometric track 3D perspective floor */}
        <div
          className="relative w-full h-32 flex items-center justify-between"
          style={{
            transform: 'perspective(800px) rotateX(25deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Base rail bedding 3D shadow */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 bg-gradient-to-r from-cyan-950/20 via-blue-900/30 to-cyan-950/20 rounded-full blur-md" />

          {/* Dual 3D Rails */}
          <div className="absolute inset-x-0 top-[42%] h-[3px] bg-slate-700/80 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]" />
          <div className="absolute inset-x-0 top-[58%] h-[3px] bg-slate-700/80 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]" />

          {/* Active progress rail glow overlay */}
          <div
            className="absolute left-0 top-[42%] h-[3px] bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full shadow-[0_0_15px_#00f0ff]"
            style={{ width: `${progressPercent}%`, transition: 'width 0.8s ease' }}
          />
          <div
            className="absolute left-0 top-[58%] h-[3px] bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full shadow-[0_0_15px_#00f0ff]"
            style={{ width: `${progressPercent}%`, transition: 'width 0.8s ease' }}
          />

          {/* 3D Sleepers / Ties along the route */}
          <div className="absolute inset-x-4 top-[35%] bottom-[35%] flex justify-between pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-[3px] h-full bg-slate-800/80 rounded-sm"
                style={{
                  transform: 'rotateY(10deg)',
                  boxShadow: i / 24 * 100 <= progressPercent ? '0 0 6px rgba(0,240,255,0.5)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Live 3D Train Node on the track */}
          <div
            className="absolute top-1/2 -translate-y-1/2 z-30 transition-all duration-700"
            style={{
              left: `calc(${progressPercent}% - 22px)`,
              transform: 'translateZ(35px)',
            }}
          >
            <div className="relative group cursor-pointer">
              {/* Outer pulsing beacon ring */}
              <div className="absolute -inset-2.5 rounded-full bg-cyan-400/30 animate-ping" />
              {/* 3D Train Pod */}
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-white flex items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.8)] transform transition-transform group-hover:scale-110">
                <span className="text-xl">🚆</span>
              </div>
              {/* Floating 3D Badge */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 text-[11px] font-mono font-bold text-cyan-300 px-2 py-0.5 rounded-md whitespace-nowrap shadow-lg">
                LIVE {progressPercent}%
              </div>
            </div>
          </div>

          {/* Station Pillar Nodes */}
          {displayNodes.map((node, index) => {
            const isPassed = displayNodes.length > 1 && (index / (displayNodes.length - 1)) * 100 <= progressPercent;
            const isHovered = activeStationIndex === index;

            return (
              <div
                key={node.code || index}
                onMouseEnter={() => setActiveStationIndex(index)}
                onMouseLeave={() => setActiveStationIndex(null)}
                className="relative z-20 flex flex-col items-center cursor-pointer group"
                style={{ transform: 'translateZ(20px)' }}
              >
                {/* Vertical 3D Station Pillar */}
                <div className="h-6 w-[2px] bg-slate-700 group-hover:bg-cyan-400 transition-colors" />

                {/* Station Node Orb */}
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isPassed
                      ? 'bg-cyan-500 border-white shadow-[0_0_12px_#00f0ff]'
                      : 'bg-slate-900 border-slate-600 group-hover:border-cyan-400'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isPassed ? 'bg-white' : 'bg-slate-500'}`} />
                </div>

                {/* Station Pillar bottom reflection */}
                <div className="h-4 w-[1px] bg-cyan-500/20" />

                {/* Station Label Floating */}
                <div
                  className={`absolute -bottom-10 flex flex-col items-center whitespace-nowrap transition-all duration-200 ${
                    isHovered ? 'scale-110 text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  <span className="font-mono text-xs font-bold">{node.code}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{node.sched}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Origin & Destination Bar */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/[0.08] relative z-10 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <div>
            <span className="text-slate-500 uppercase font-semibold block text-[10px]">Origin</span>
            <span className="text-white font-bold text-sm">{origin || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end text-right">
          <div>
            <span className="text-slate-500 uppercase font-semibold block text-[10px]">Destination</span>
            <span className="text-white font-bold text-sm">{destination || '—'}</span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
        </div>
      </div>
    </TiltCard>
  );
}
