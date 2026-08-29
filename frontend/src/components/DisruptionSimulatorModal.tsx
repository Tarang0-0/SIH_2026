"use client";

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Sparkles, 
  Zap, 
  CloudFog, 
  Wrench, 
  Cpu, 
  ArrowRight,
  CheckCircle2,
  Sliders
} from 'lucide-react';

interface DisruptionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeyId: string;
  trainNumber: string;
  trainName: string;
  stations: string[];
  currentStation: string;
  onSimulationSuccess?: (data: any) => void;
}

const PRESETS = [
  { label: "Signal Failure", delay: 20, icon: Zap, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { label: "Winter Fog Slowdown", delay: 35, icon: CloudFog, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
  { label: "Track Maintenance", delay: 45, icon: Wrench, color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { label: "Loco Defect", delay: 15, icon: Cpu, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" }
];

export default function DisruptionSimulatorModal({
  isOpen,
  onClose,
  journeyId,
  trainNumber,
  trainName,
  stations,
  currentStation,
  onSimulationSuccess
}: DisruptionSimulatorModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("Signal Failure");
  const [delayMinutes, setDelayMinutes] = useState<number>(20);
  const [sectionFrom, setSectionFrom] = useState<string>(currentStation || stations[0] || "GZB");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset.label);
    setDelayMinutes(preset.delay);
  };

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/simulate/disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey_id: journeyId,
          additional_delay_minutes: delayMinutes,
          section_from: sectionFrom,
          disruption_type: selectedPreset
        })
      });

      if (!res.ok) {
        throw new Error(`Simulation failed: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
      if (onSimulationSuccess) {
        onSimulationSuccess(data.prediction);
      }
    } catch (err: any) {
      setError(err.message || 'Error running disruption simulation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/20 shadow-2xl bg-[#0b1220]/95 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">What-If Disruption Simulator</h3>
              <p className="text-xs font-mono text-slate-400">{trainNumber} · {trainName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Operational Scenario Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const isSelected = selectedPreset === p.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    isSelected ? p.color + ' ring-1 ring-white/30 font-semibold' : 'border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs truncate">{p.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">+{p.delay} min</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delay Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Injected Delay Delta:</span>
            <span className="text-amber-400 font-bold text-sm">+{delayMinutes} minutes</span>
          </div>
          <input 
            type="range" 
            min="-10" 
            max="90" 
            step="5"
            value={delayMinutes} 
            onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>-10m (Recovery)</span>
            <span>0m (Nominal)</span>
            <span>+45m</span>
            <span>+90m (Severe)</span>
          </div>
        </div>

        {/* Target Section Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Disruption Inception Station
          </label>
          <select
            value={sectionFrom}
            onChange={(e) => setSectionFrom(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            {stations.map(stn => (
              <option key={stn} value={stn}>Station {stn}</option>
            ))}
          </select>
        </div>

        {/* Result Callout if simulated */}
        {result && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Simulated: Total Delay <b>+{result.new_total_delay_minutes}m</b></span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">WS Broadcasted</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSimulate}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white font-mono text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Simulating...' : 'Simulate What-If Disruption'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
