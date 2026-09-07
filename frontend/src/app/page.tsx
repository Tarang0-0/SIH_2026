'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import { apiUrl } from '../lib/api';

interface TrainSearchResult {
  train_number: string;
  train_name: string;
  origin: string;
  dest: string;
}

interface HealthSummary {
  models_active: boolean;
  indexed_routes: number;
  live_provider: string | null;
  weather_provider: string | null;
}

const indiaDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrainSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [journeyDate, setJourneyDate] = useState(indiaDate());
  const [health, setHealth] = useState<HealthSummary | null>(null);

  useEffect(() => {
    fetch(apiUrl('/health'))
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setHealth({
        models_active: Boolean(data.models_active),
        indexed_routes: Number(data.indexed_routes) || 0,
        live_provider: data.live_provider || null,
        weather_provider: data.weather_provider || null,
      }))
      .catch(() => setHealth(null));
  }, []);

  // Debounced search
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setSearchResults([]);
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(apiUrl(`/api/v1/trains/search?q=${encodeURIComponent(query)}`))
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setSearchResults(Array.isArray(data) ? data : []);
          setIsSearching(false);
        })
        .catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTrain = (trainNo: string) => {
    const typed = trainNo.trim();
    const selected = /^\d+$/.test(typed)
      ? typed
      : searchResults[0]?.train_number;
    if (selected) router.push(`/dashboard?train=${encodeURIComponent(selected)}&date=${encodeURIComponent(journeyDate)}`);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-white/[0.08] bg-gradient-to-b from-[#0d1322] via-[#070b14] to-[#070b14]">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>National Train Enquiry & Telemetry Gateway</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Real-Time Train Telemetry & <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-400">
              Predictive Arrival Intelligence
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Move beyond static scheduled timetables. RailPulse combines configured live-status providers with gradient-boosted ML to deliver ETA intervals and transparent delay attribution.
          </p>

          {/* Clean Operational Search Console */}
          <div className="max-w-2xl mx-auto relative text-left">
            <div className="panel-card p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 border border-slate-700/80 shadow-2xl focus-within:border-blue-500 transition-colors">
              <div className="relative flex-grow flex items-center">
                <span className="absolute left-3.5 text-slate-400 font-mono text-sm">#</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSelectTrain(searchQuery);
                    }
                  }}
                  placeholder="Enter a train number or name..."
                  className="w-full pl-8 pr-4 py-3 bg-transparent text-white placeholder-slate-500 font-mono text-sm sm:text-base outline-none"
                />
                {isSearching && (
                  <div className="absolute right-3.5 w-4 h-4 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin"></div>
                )}
              </div>

              <button
                onClick={() => handleSelectTrain(searchQuery)}
                disabled={!searchQuery.trim() || (searchResults.length === 0 && !/^\d+$/.test(searchQuery.trim()))}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Track Train</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3 text-xs font-mono text-slate-400">
              <label htmlFor="landing-journey-date">Journey date</label>
              <input
                id="landing-journey-date"
                type="date"
                value={journeyDate}
                onChange={(event) => setJourneyDate(event.target.value)}
                className="bg-[#111827] border border-white/[0.1] rounded-lg px-3 py-2 text-white outline-none [color-scheme:dark]"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-[#0d1322] border border-slate-700/90 rounded-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
                {searchResults.map((train) => (
                  <button
                    key={train.train_number}
                    onClick={() => {
                      setSearchQuery(train.train_number);
                      handleSelectTrain(train.train_number);
                    }}
                    className="w-full text-left px-4 py-3 border-b border-white/[0.06] hover:bg-blue-600/15 flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-bold font-mono text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        <span>{train.train_number}</span>
                        <span className="font-sans font-medium text-slate-300 text-xs sm:text-sm">{train.train_name}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 font-mono text-right">
                      <span>{train.origin}</span>
                      <span className="text-slate-600 mx-1.5">➔</span>
                      <span>{train.dest}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

          </div>

        </div>
      </section>

      {/* Real-World Telemetry Capabilities Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="text-xs font-mono uppercase text-blue-400 font-bold tracking-wider mb-2">Technical Foundations</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Engineered for Modern Indian Railways Operations
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Standard passenger systems assume trains run on ideal schedules. RailPulse uses the live weather, station-board, and network signals that are actually available from configured providers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="panel-card p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider mb-1">Gradient Boosting Core</div>
              <h3 className="text-lg font-bold text-white mb-2">Quantile Arrival Forecasts</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Trained multi-quantile XGBoost models output 10th, 50th, and 90th percentile arrival windows rather than brittle single-point estimates.
              </p>
            </div>
            <div className="border-t border-white/[0.06] pt-3 text-[11px] font-mono text-slate-500 flex justify-between">
              <span>Model Confidence:</span>
              <span className="text-emerald-400 font-semibold">P10 - P50 - P90 Interval</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="panel-card p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1">Explainable AI</div>
              <h3 className="text-lg font-bold text-white mb-2">Causal Delay Attribution</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Utilizes Tree SHAP value attribution to transparently report the primary cause behind every delayed halt (e.g. preceding freight overtakes, fog restrictions).
              </p>
            </div>
            <div className="border-t border-white/[0.06] pt-3 text-[11px] font-mono text-slate-500 flex justify-between">
              <span>Attribution Method:</span>
              <span className="text-emerald-400 font-semibold">SHAP Factor Isolation</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="panel-card p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" />
                </svg>
              </div>
              <div className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider mb-1">Live Telemetry</div>
              <h3 className="text-lg font-bold text-white mb-2">Continuous RTIS Streaming</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Direct Server-Sent Events (SSE) stream verified speed, GPS satellite locks, and active corridor block signals without needing page reloads.
              </p>
            </div>
            <div className="border-t border-white/[0.06] pt-3 text-[11px] font-mono text-slate-500 flex justify-between">
              <span>Protocol:</span>
              <span className="text-purple-400 font-semibold">Server-Sent Events (SSE)</span>
            </div>
          </div>

        </div>
      </section>

      {/* Live service summary */}
      <section className="border-y border-white/[0.08] bg-[#0d1322] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center font-mono">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{health?.indexed_routes || '—'}</div>
            <div className="text-xs text-slate-400 uppercase">Indexed routes</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 mb-1">{health?.live_provider || '—'}</div>
            <div className="text-xs text-slate-400 uppercase">Live provider</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mb-1">{health?.weather_provider || '—'}</div>
            <div className="text-xs text-slate-400 uppercase">Weather provider</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 mb-1">{health?.models_active ? 'Online' : '—'}</div>
            <div className="text-xs text-slate-400 uppercase">ML service</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.08] py-8 px-4 sm:px-6 lg:px-8 bg-[#070b14] text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-300 font-semibold">RailPulse</span>
            <span>• Smart India Hackathon 2026</span>
          </div>
          <div className="flex gap-6 text-slate-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">Live Dashboard</Link>
            <Link href="/features" className="hover:text-white transition-colors">Architecture</Link>
            <Link href="/about" className="hover:text-white transition-colors">About Team</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
