'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TiltCard from '../components/TiltCard';
import { useLanguage } from '../components/LanguageContext';
import Logo from '../components/Logo';

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-sky-500/20">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Header Banner */}
        <section className="relative bg-gradient-to-b from-sky-100/60 to-[#f7f9fc] dark:from-[#0b1c38]/50 dark:via-[#09162e]/40 dark:to-transparent border-b border-sky-200/70 dark:border-sky-900/60 py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="flex justify-center mb-6">
              <Logo variant="horizontal" size="xl" className="h-16 sm:h-20 w-auto" />
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800/80 text-sky-700 dark:text-sky-300 text-xs font-mono mb-4 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span>{t('about_hero_badge', 'SMART INDIA HACKATHON 2026')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
              {t('about_hero_title', 'About Project RailTrackr')}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {t('about_hero_subtitle', "Pioneering dynamic transit intelligence and transparent delay attribution for the world's fourth largest railway network.")}
            </p>
          </div>
        </section>

        {/* Narrative Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-12">
          
          {/* The Problem & The Solution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TiltCard maxTilt={6} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-xs hover:border-rose-400 dark:hover:border-rose-500/70 transition-all">
              <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
                {t('about_challenge_badge', 'The Challenge')}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                {t('about_challenge_title', 'Transit Uncertainty at Scale')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('about_challenge_desc', 'Large railway networks experience congestion and cascading delays that frequently render published timetables inaccurate. Standard enquiry systems often lack predictive depth and transparent explanations for passengers.')}
              </p>
            </TiltCard>

            <TiltCard maxTilt={6} className="bg-white dark:bg-[#0b1528] p-6 sm:p-7 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl shadow-xs hover:border-emerald-400 dark:hover:border-emerald-500/70 transition-all">
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                {t('about_solution_badge', 'The Solution')}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                {t('about_solution_title', 'Data-Driven Precision')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('about_solution_desc', 'RailTrackr integrates real-time locomotive GPS streams from the Real-Time Train Information System (RTIS) with multi-quantile gradient boosting. The system continuously refines arrival estimates and uses explainable AI to transparently account for delays.')}
              </p>
            </TiltCard>
          </div>

          {/* Specifications Table */}
          <div className="bg-white dark:bg-[#0b1528] p-6 sm:p-8 rounded-2xl border border-slate-200/90 dark:border-sky-900/60 shadow-xs">
            <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-2">
              {t('about_specs_badge', 'Technical Specifications')}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {t('about_specs_title', 'Stack & Infrastructure Matrix')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">
                  {t('about_ml_core_cat', 'Machine Learning Core')}
                </div>
                <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                  {t('about_ml_core_title', 'XGBoost Multi-Quantile')}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('about_ml_core_desc', 'Pinball loss regression for P10, P50, and P90 uncertainty intervals.')}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">
                  {t('about_explain_cat', 'Explainability Engine')}
                </div>
                <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                  {t('about_explain_title', 'Tree SHAP Factor Isolation')}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('about_explain_desc', 'Feature attribution isolating congestion, weather, and section headway.')}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">
                  {t('about_api_cat', 'High-Performance API')}
                </div>
                <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                  {t('about_api_title', 'FastAPI + Asynchronous SSE')}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('about_api_desc', 'Server-Sent Events streaming telemetry from the configured live provider.')}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl">
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase">
                  {t('about_console_cat', 'Operational Console')}
                </div>
                <div className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                  {t('about_console_title', 'Next.js 16 + Leaflet GIS')}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {t('about_console_desc', 'Dynamic route polyline interpolation with zero hardcoded coordinate tables.')}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="text-center pt-4">
            <Link
              href="/dashboard?train=12951"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs font-mono px-7 py-3.5 rounded-xl transition-all shadow-sm shadow-sky-500/20"
            >
              <span>{t('about_launch_btn', 'Launch Operations Console')}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
}
