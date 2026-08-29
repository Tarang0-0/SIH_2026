"use client";

import React from 'react';
import { BrainCircuit, CheckCircle2, ShieldCheck } from 'lucide-react';

interface SHAPExplainerCardProps {
  shapExplanation?: Record<string, number>;
  loading?: boolean;
}

export default function SHAPExplainerCard({
  shapExplanation = {},
  loading = false
}: SHAPExplainerCardProps) {
  const hasFeatures = shapExplanation && Object.keys(shapExplanation).length > 0;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Feature Impact Card */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-emerald-400" />
            Feature Impact (SHAP)
          </h3>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-white/5">
            TreeExplainer v1.0
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Deterministic attribution of operational and topological features impacting future section delay propagation:
        </p>

        <div className="flex flex-col gap-4 flex-1 justify-center">
          {hasFeatures ? (
            Object.entries(shapExplanation).map(([feat, val]) => {
              const isNegative = val < 0; // Delay reduction
              const absVal = Math.min(100, Math.abs(val) * 7.5); // Scaled bar width

              return (
                <div key={feat} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 truncate max-w-[170px] capitalize">
                      {feat.replace(/_/g, ' ')}
                    </span>
                    <span className={isNegative ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {val > 0 ? `+${val}m` : `${val}m`}
                    </span>
                  </div>

                  <div className="flex items-center h-3 relative">
                    {/* Center divider axis */}
                    <div className="w-1/2 h-full border-r border-white/20"></div>
                    <div className="w-1/2 h-full"></div>

                    {/* Diverging Bar */}
                    {isNegative ? (
                      <div 
                        style={{ width: `${absVal}%` }}
                        className="absolute right-1/2 h-1.5 bg-emerald-400 rounded-l-full shadow-[0_0_8px_rgba(78,222,163,0.6)]"
                      ></div>
                    ) : (
                      <div 
                        style={{ width: `${absVal}%` }}
                        className="absolute left-1/2 h-1.5 bg-amber-400 rounded-r-full shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      ></div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500 font-mono text-xs">
              {loading ? 'Computing SHAP feature attributions...' : 'Loading TreeExplainer values...'}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[10px] font-mono text-slate-400">
          <span className="text-emerald-400 font-medium">← Delay Reduction</span>
          <span className="text-amber-400 font-medium">Delay Increase →</span>
        </div>
      </div>

      {/* Zero-Data Leakage Guarantee Badge */}
      <div className="glass-panel rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>Zero Data Leakage Invariant</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Forecasts at timestamp <i>T</i> strictly ingest data available at or before <i>T</i>. No future state lookahead or fabricated metrics.
        </p>
      </div>
    </div>
  );
}
