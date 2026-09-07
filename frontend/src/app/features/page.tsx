'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function FeaturesPage() {
  const architectures = [
    {
      step: '01',
      badge: 'DATA INGESTION',
      title: 'RTIS & Schedule Integration',
      desc: 'Ingests timestamped live train telemetry from the configured authorised provider and combines it with the route timetable catalog.',
      metric: 'Provider-backed ingestion',
    },
    {
      step: '02',
      badge: 'ML INFERENCE',
      title: 'Multi-Quantile XGBoost Engine',
      desc: 'Computes P10, P50, and P90 arrival quantiles from the deployed feature contract, with live signals added only when provider-backed training data supports them.',
      metric: 'Chronological holdout validation',
    },
    {
      step: '03',
      badge: 'EXPLAINABLE AI',
      title: 'Tree SHAP Causal Attribution',
      desc: 'Deconstructs predictions into human-readable feature contributions and reports the model factors available for the current request.',
      metric: 'Transparent feature attribution',
    },
    {
      step: '04',
      badge: 'CLIENT TELEMETRY',
      title: 'Real-Time SSE Gateway',
      desc: 'Streams live coordinates, speed, and revised downstream station arrival estimates to client dashboards with zero manual page refreshes.',
      metric: 'Provider timestamped updates',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Header Banner */}
      <section className="bg-[#0d1322] border-b border-white/[0.08] py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono mb-4">
            <span>ENGINEERING ARCHITECTURE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
            System Capabilities & Design
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A comprehensive overview of the machine learning pipelines, geospatial algorithms, and telemetry services powering RailPulse.
          </p>
        </div>
      </section>

      {/* Pipeline Flow Architecture */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-xs font-mono uppercase text-blue-400 font-bold tracking-wider mb-2">End-to-End Pipeline</div>
        <h2 className="text-2xl font-bold text-white mb-8">Data Flow & Predictive Stack</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {architectures.map((arch) => (
            <div key={arch.step} className="panel-card p-6 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-blue-500">{arch.step}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {arch.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{arch.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{arch.desc}</p>
              </div>
              <div className="border-t border-white/[0.06] pt-3 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{arch.metric}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Deep Dive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          
          {/* Deep Dive 1: Quantile Forecasting */}
          <div className="panel-card p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-blue-400">⚡</span>
              Multi-Quantile Forecasting (P10 / P50 / P90)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Standard transit APIs only report single-point arrival estimates that degrade when trains encounter congestion. RailPulse fits dedicated pinball loss regressors to compute empirical prediction intervals:
            </p>
            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg font-mono text-xs text-slate-300 space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">P10 (Optimistic):</span><span className="text-emerald-400 font-bold">Lower-bound ETA interval</span></div>
              <div className="flex justify-between"><span className="text-slate-500">P50 (Expected Median):</span><span className="text-blue-400 font-bold">Primary ETA estimate</span></div>
              <div className="flex justify-between"><span className="text-slate-500">P90 (Conservative):</span><span className="text-amber-400 font-bold">Upper-bound ETA interval</span></div>
            </div>
          </div>

          {/* Deep Dive 2: Explainability Engine */}
          <div className="panel-card p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-emerald-400">🧠</span>
              SHAP Causal Delay Decomposition
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Passengers and operators can inspect exact causal drivers. Tree SHAP isolates individual feature contributions for each downstream halt:
            </p>
            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg font-mono text-xs text-slate-300 space-y-2">
              <div className="text-slate-400">The API returns request-specific feature attribution when the trained model and its explainer are available. Values are never hardcoded into the interface.</div>
            </div>
          </div>

        </div>

        {/* Action Banner */}
        <div className="panel-card p-8 border border-blue-500/30 text-center bg-gradient-to-r from-blue-950/40 via-[#0d1322] to-blue-950/40">
          <h3 className="text-xl font-bold text-white mb-2">Ready to inspect a running train?</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Experience the dual-pane operational dashboard with live station halts and real-time GIS route maps.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-6 py-3 rounded-lg transition-colors"
          >
            <span>Open Operations Dashboard</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.08] py-6 px-4 sm:px-6 lg:px-8 bg-[#070b14] text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>RailPulse • Indian Railways Operations Architecture</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-slate-300">Home</Link>
            <Link href="/dashboard" className="hover:text-slate-300">Live Tracker</Link>
            <Link href="/about" className="hover:text-slate-300">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
