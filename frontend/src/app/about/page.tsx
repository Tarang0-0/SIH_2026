'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import TiltCard from '../components/TiltCard';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#eef7ff] dark:bg-[#060c18] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-sky-500/20">
      <Navbar />

      {/* Header Banner */}
      <section className="relative bg-gradient-to-b from-sky-100/60 to-[#eef7ff] dark:from-[#0b1c38]/70 dark:via-[#09162e]/70 dark:to-[#060c18] border-b border-sky-200/70 dark:border-sky-900/60 py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/80 text-sky-700 dark:text-sky-300 text-xs font-mono mb-4 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>SMART INDIA HACKATHON 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            About Project Namaste Rail
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Pioneering dynamic transit intelligence and transparent delay attribution for the world&apos;s fourth largest railway network.
          </p>
        </div>
      </section>

      {/* Narrative Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-12">
        
        {/* The Problem & The Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TiltCard maxTilt={6} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-xs hover:border-rose-400 dark:hover:border-rose-500/70 transition-all">
            <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">The Challenge</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Transit Uncertainty at Scale</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Large railway networks experience congestion and cascading delays that frequently render published timetables inaccurate. Standard enquiry systems often lack predictive depth and transparent explanations for passengers.
            </p>
          </TiltCard>

          <TiltCard maxTilt={6} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl shadow-xs hover:border-emerald-400 dark:hover:border-emerald-500/70 transition-all">
            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">The Solution</div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Data-Driven Precision</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Namaste Rail integrates real-time locomotive GPS streams from the Real-Time Train Information System (RTIS) with multi-quantile gradient boosting. The system continuously refines arrival estimates and uses explainable AI to transparently account for delays.
            </p>
          </TiltCard>
        </div>

        {/* Specifications Table */}
        <div className="bg-white dark:bg-[#0b1528] p-6 sm:p-8 rounded-2xl border border-slate-200/90 dark:border-sky-900/60 shadow-xs">
          <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-2">Technical Specifications</div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Stack & Infrastructure Matrix</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">Machine Learning Core</div>
              <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">XGBoost Multi-Quantile</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">Pinball loss regression for P10, P50, and P90 uncertainty intervals.</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">Explainability Engine</div>
              <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">Tree SHAP Factor Isolation</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">Feature attribution isolating congestion, weather, and section headway.</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">High-Performance API</div>
              <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">FastAPI + Asynchronous SSE</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">Server-Sent Events streaming telemetry from the configured live provider.</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">Operational Console</div>
              <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">Next.js 16 + Leaflet GIS</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">Dynamic route polyline interpolation with zero hardcoded coordinate tables.</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-4">
          <Link
            href="/dashboard?train=12951"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs font-mono px-7 py-3.5 rounded-xl transition-all shadow-sm shadow-sky-500/20"
          >
            <span>Launch Operations Console</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-sky-200/70 dark:border-sky-900/60 py-6 px-4 sm:px-6 lg:px-8 bg-sky-50/50 dark:bg-[#060c18]/90 text-xs font-mono text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>Namaste Rail • Smart India Hackathon 2026</div>
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
