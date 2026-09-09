'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import TiltCard from '../components/TiltCard';

export default function FeaturesPage() {
  const architectures = [
    {
      step: '01',
      badge: 'DATA INGESTION',
      title: 'RTIS & Schedule Integration',
      desc: 'Ingests timestamped live train telemetry from the configured authorised provider and combines it with the route timetable catalog.',
      metric: 'Provider-backed ingestion',
      color: 'text-cyan-400',
      border: 'hover:border-cyan-400/40',
    },
    {
      step: '02',
      badge: 'ML INFERENCE',
      title: 'Multi-Quantile XGBoost Engine',
      desc: 'Computes P10, P50, and P90 arrival quantiles from the deployed feature contract, with live signals added only when provider-backed training data supports them.',
      metric: 'Chronological holdout validation',
      color: 'text-blue-400',
      border: 'hover:border-blue-400/40',
    },
    {
      step: '03',
      badge: 'EXPLAINABLE AI',
      title: 'Tree SHAP Causal Attribution',
      desc: 'Deconstructs predictions into human-readable feature contributions and reports the model factors available for the current request.',
      metric: 'Transparent feature attribution',
      color: 'text-amber-400',
      border: 'hover:border-amber-400/40',
    },
    {
      step: '04',
      badge: 'CLIENT TELEMETRY',
      title: 'Real-Time SSE Gateway',
      desc: 'Streams live coordinates, speed, and revised downstream station arrival estimates to client dashboards with zero manual page refreshes.',
      metric: 'Provider timestamped updates',
      color: 'text-emerald-400',
      border: 'hover:border-emerald-400/40',
    },
  ];

  return (
    <div className="min-h-screen bg-[#eef7ff] dark:bg-[#060c18] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-sky-500/20">
      <Navbar />

      {/* Header Banner */}
      <section className="relative bg-gradient-to-b from-sky-100/60 to-[#eef7ff] dark:from-[#0b1c38]/70 dark:via-[#09162e]/70 dark:to-[#060c18] border-b border-sky-200/70 dark:border-sky-900/60 py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/80 text-sky-700 dark:text-sky-300 text-xs font-mono mb-4 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>ENGINEERING ARCHITECTURE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            System Capabilities & Design
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A comprehensive overview of the machine learning pipelines, geospatial algorithms, and telemetry services powering Namaste Rail.
          </p>
        </div>
      </section>

      {/* Pipeline Flow Architecture */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-xs font-mono uppercase text-sky-600 dark:text-sky-400 font-bold tracking-wider mb-2">End-to-End Pipeline</div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-8">Data Flow & Predictive Stack</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {architectures.map((arch) => (
            <TiltCard key={arch.step} maxTilt={6} className={`bg-white dark:bg-[#0b1528] p-6 border border-slate-200/90 dark:border-sky-900/60 hover:border-sky-400 dark:hover:border-sky-500 transition-all flex flex-col justify-between rounded-2xl shadow-xs`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-mono text-3xl font-black ${arch.color}`}>{arch.step}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {arch.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{arch.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{arch.desc}</p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px] font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_6px_#0ea5e9]" />
                <span>{arch.metric}</span>
              </div>
            </TiltCard>
          ))}
        </div>

        {/* Deep Dive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          
          {/* Deep Dive 1: Quantile Forecasting */}
          <TiltCard maxTilt={5} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-slate-200/90 dark:border-sky-900/60 rounded-2xl shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg>
              Multi-Quantile Forecasting (P10 / P50 / P90)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Standard transit APIs only report single-point arrival estimates that degrade when trains encounter congestion. Namaste Rail fits dedicated pinball loss regressors to compute empirical prediction intervals:
            </p>
            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">P10 (Optimistic):</span><span className="text-emerald-600 dark:text-emerald-400 font-bold">Lower-bound ETA interval</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">P50 (Expected Median):</span><span className="text-sky-700 dark:text-sky-400 font-bold">Primary ETA estimate</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">P90 (Conservative):</span><span className="text-amber-600 dark:text-amber-400 font-bold">Upper-bound ETA interval</span></div>
            </div>
          </TiltCard>

          {/* Deep Dive 2: Explainability Engine */}
          <TiltCard maxTilt={5} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-slate-200/90 dark:border-sky-900/60 rounded-2xl shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4.5A3.5 3.5 0 0 0 5.5 8c0 .5.1 1 .3 1.4A3.5 3.5 0 0 0 7 16.2a3.5 3.5 0 0 0 6.1 2.1A3.5 3.5 0 0 0 19 16.2a3.5 3.5 0 0 0 1.2-6.8c.2-.4.3-.9.3-1.4A3.5 3.5 0 0 0 17 4.5c-.8 0-1.5.3-2.1.7A3.5 3.5 0 0 0 9 4.5Z"/><path d="M12 6v12M8.5 9.5H12M12 14.5h3.5"/></svg>
              SHAP Causal Delay Decomposition
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Passengers and operators can inspect exact causal drivers. Tree SHAP isolates individual feature contributions for each downstream halt:
            </p>
            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl font-mono text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div>The API returns request-specific feature attribution when the trained model and its explainer are available. Factors include section blockages, weather severity, and priority rake crossings.</div>
            </div>
          </TiltCard>

        </div>

        {/* Action Banner */}
        <div className="bg-white dark:bg-[#0b1528] p-8 sm:p-10 border border-sky-200 dark:border-sky-900/60 text-center rounded-2xl relative overflow-hidden shadow-xs">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-blue-500/5 to-transparent pointer-events-none" />
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 relative z-10">Ready to inspect a running train?</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 relative z-10 leading-relaxed">
            Experience the dual-pane operational dashboard with live corridor tracks and real-time GIS route maps.
          </p>
          <Link
            href="/dashboard?train=12951"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs font-mono px-6 py-3 rounded-xl transition-all shadow-sm shadow-sky-500/20 relative z-10"
          >
            <span>Open Operations Dashboard</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-sky-200/70 dark:border-sky-900/60 py-6 px-4 sm:px-6 lg:px-8 bg-sky-50/50 dark:bg-[#060c18]/90 text-xs font-mono text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>Namaste Rail • Indian Railways Operations Architecture</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Home</Link>
            <Link href="/dashboard" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Live Tracker</Link>
            <Link href="/operator" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Admin Control Room</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
