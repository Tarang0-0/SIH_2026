'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Header Banner */}
      <section className="bg-[#0d1322] border-b border-white/[0.08] py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono mb-4">
            <span>SMART INDIA HACKATHON 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
            About Project RailPulse
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Pioneering dynamic transit intelligence and transparent delay attribution for the world&apos;s fourth largest railway network.
          </p>
        </div>
      </section>

      {/* Narrative Section */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-12">
        
        {/* The Problem & The Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="panel-card p-6 border border-slate-800">
            <div className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider mb-2">The Challenge</div>
            <h3 className="text-lg font-bold text-white mb-3">Transit Uncertainty at Scale</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Large railway networks experience congestion and cascading delays that frequently render published timetables inaccurate. Standard enquiry systems often lack predictive depth and transparent explanations for passengers.
            </p>
          </div>

          <div className="panel-card p-6 border border-slate-800">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-2">The Solution</div>
            <h3 className="text-lg font-bold text-white mb-3">Data-Driven Precision</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              RailPulse integrates real-time locomotive GPS streams from the Real-Time Train Information System (RTIS) with multi-quantile gradient boosting. The system continuously refines arrival estimates and uses explainable AI to transparently account for delays.
            </p>
          </div>
        </div>

        {/* Specifications Table */}
        <div className="panel-card p-6 border border-slate-800">
          <div className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider mb-2">Technical Specifications</div>
          <h3 className="text-lg font-bold text-white mb-6">Stack & Infrastructure Matrix</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg">
              <div className="text-slate-500 text-[11px] mb-1 uppercase">Machine Learning Core</div>
              <div className="text-white font-bold text-sm mb-1">XGBoost Multi-Quantile</div>
              <div className="text-slate-400 text-[11px]">Pinball loss regression for P10, P50, and P90 uncertainty intervals.</div>
            </div>

            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg">
              <div className="text-slate-500 text-[11px] mb-1 uppercase">Explainability Engine</div>
              <div className="text-white font-bold text-sm mb-1">Tree SHAP Factor Isolation</div>
              <div className="text-slate-400 text-[11px]">Feature attribution isolating congestion, weather, and section headway.</div>
            </div>

            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg">
              <div className="text-slate-500 text-[11px] mb-1 uppercase">High-Performance API</div>
              <div className="text-white font-bold text-sm mb-1">FastAPI + Asynchronous SSE</div>
              <div className="text-slate-400 text-[11px]">Server-Sent Events streaming telemetry from the configured live provider.</div>
            </div>

            <div className="bg-[#090e1a] border border-white/[0.06] p-4 rounded-lg">
              <div className="text-slate-500 text-[11px] mb-1 uppercase">Operational Console</div>
              <div className="text-white font-bold text-sm mb-1">Next.js 16 + Leaflet GIS</div>
              <div className="text-slate-400 text-[11px]">Dynamic route polyline interpolation with zero hardcoded coordinate tables.</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            <span>Launch Operations Console</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.08] py-6 px-4 sm:px-6 lg:px-8 bg-[#070b14] text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>RailPulse • Smart India Hackathon 2026</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-slate-300">Home</Link>
            <Link href="/dashboard" className="hover:text-slate-300">Live Tracker</Link>
            <Link href="/features" className="hover:text-slate-300">Architecture</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
