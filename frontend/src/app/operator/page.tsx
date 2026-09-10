'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../components/LanguageContext';
import { apiUrl } from '../../lib/api';

interface Incident {
  train_number: string;
  journey_date: string;
  current_station: string;
  next_station?: string | null;
  delay_minutes: number;
  halt_status: 'halted' | 'moving' | 'unknown';
  speed_kmh?: number | null;
  provider: string;
  observed_at: string;
}

interface AffectedTrain {
  train_number: string;
  train_name: string;
  station_code: string;
  scheduled_arrival?: string | null;
  expected_arrival?: string | null;
  delay_minutes?: number | null;
  impact_reason: string;
  provider: string;
}

interface ImpactResponse {
  incident: Incident;
  affected_station_codes: string[];
  affected_trains: AffectedTrain[];
  data_quality: {
    provider: string;
    occupancy_data_available: boolean;
    blockage_causality_confirmed: boolean;
    failed_station_boards: string[];
    network_signals_available?: boolean;
    network_signal_provider?: string | null;
  };
}

const ADMIN_SESSION_KEY = 'railpulse_admin_authenticated';

const displayTime = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(parsed);
  }
  return value.slice(0, 5);
};

export default function OperatorPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [authChecked, setAuthChecked] = useState(false);
  const [trainNumber, setTrainNumber] = useState('');
  const [lookahead, setLookahead] = useState('4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState<ImpactResponse | null>(null);

  const sampleTrains = [
    { number: '12951', name: 'Mumbai Tejas Rajdhani' },
    { number: '12002', name: 'Bhopal Shatabdi' },
    { number: '12301', name: 'Howrah Rajdhani' },
    { number: '12259', name: 'Sealdah Duronto' },
    { number: '22436', name: 'Vande Bharat Exp' },
  ];

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
      router.replace('/admin/login?next=/operator');
      return;
    }
    const frameId = window.requestAnimationFrame(() => setAuthChecked(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [router]);

  const executeAnalysis = async (targetTrain: string, stationsLookahead: string) => {
    const key = targetTrain.trim();
    if (!key) {
      setError(t('op_enter_train_err', 'Enter a train number to inspect the live downstream impact.'));
      return;
    }
    setLoading(true);
    setError('');
    setImpact(null);
    try {
      const query = new URLSearchParams({ lookahead_stations: stationsLookahead });
      const response = await fetch(apiUrl(`/api/v1/control-room/impact/${encodeURIComponent(key)}?${query.toString()}`));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || 'The live control-room analysis is unavailable.');
      setImpact(body as ImpactResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load live impact data.');
    } finally {
      setLoading(false);
    }
  };

  const analyzeImpact = async (event: React.FormEvent) => {
    event.preventDefault();
    await executeAnalysis(trainNumber, lookahead);
  };

  const handleSelectSample = (number: string) => {
    setTrainNumber(number);
    void executeAnalysis(number, lookahead);
  };

  const incident = impact?.incident;

  // Semantic status color coding
  const getDelayBadge = (delayMinutes?: number | null) => {
    if (delayMinutes == null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Unknown
        </span>
      );
    }
    if (delayMinutes <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {t('op_on_time_badge', 'On time (0m)')}
        </span>
      );
    }
    if (delayMinutes <= 15) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          +{delayMinutes}m {t('op_moderate_delay', 'moderate')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        +{delayMinutes}m {t('op_critical_delay', 'critical')}
      </span>
    );
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          {t('op_auth_session', 'Authenticating dispatch session…')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 font-sans relative overflow-x-hidden selection:bg-blue-500/20">
      <Navbar />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-1 text-[11px] font-mono uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-3">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              {t('op_badge', 'Operations Dispatch Console • Restricted Access')}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('op_title', 'Corridor Impact & Cascade Control')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed text-xs sm:text-sm">
              {t('op_desc', 'Live corridor triage analyzing downstream station exposure from halted or delayed services. Correlates RTIS locomotive telemetry with station arrivals to identify potential headway conflicts.')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1528] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition cursor-pointer"
            >
              {t('op_passenger_search', 'Passenger Search')}
            </button>
            <button
              type="button"
              onClick={() => {
                window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
                router.replace('/admin/login?next=/operator');
              }}
              className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-rose-950/20 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:border-rose-300 dark:hover:border-rose-700 shadow-xs transition cursor-pointer"
            >
              {t('op_sign_out', 'Sign out')}
            </button>
          </div>
        </div>

        {/* Triage Search & Filter Console */}
        <div className="bg-white/90 dark:bg-[#0b1528]/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm mb-6">
          <form onSubmit={analyzeImpact} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-4 items-end">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              <span className="block mb-1.5 font-bold uppercase tracking-wider text-[11px]">{t('op_inspect_label', 'Train to Inspect')}</span>
              <input
                value={trainNumber}
                onChange={(event) => setTrainNumber(event.target.value)}
                placeholder={t('op_inspect_placeholder', 'Enter 5-digit train number (e.g. 12951)')}
                inputMode="numeric"
                className="w-full bg-slate-50 dark:bg-[#071827]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              <span className="block mb-1.5 font-bold uppercase tracking-wider text-[11px]">{t('op_depth_label', 'Lookahead Depth')}</span>
              <select
                value={lookahead}
                onChange={(event) => setLookahead(event.target.value)}
                className="w-full bg-slate-50 dark:bg-[#071827]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                  <option key={value} value={value}>
                    {value} {t('op_depth_suffix', 'downstream stations')}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl px-7 py-2.5 text-sm transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{t('op_analyzing', 'Analyzing…')}</span>
                </>
              ) : (
                <span>{t('op_analyze_btn', 'Analyze Impact')}</span>
              )}
            </button>
          </form>

          {/* Quick-test Preset Trains */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">{t('op_quick_preset', 'Quick Preset:')}</span>
            {sampleTrains.map((sample) => (
              <button
                key={sample.number}
                type="button"
                onClick={() => handleSelectSample(sample.number)}
                className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  trainNumber === sample.number
                    ? 'bg-sky-500 text-white border-sky-600 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-400 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-[#0c1729] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-cyan-500/50'
                }`}
              >
                <span className="font-bold">{sample.number}</span> <span className="opacity-75 hidden sm:inline">• {sample.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-300 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-400/10 p-4 text-sm text-rose-700 dark:text-rose-200 flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Empty state when no analysis performed yet */}
        {!impact && !loading && !error && (
          <div className="bg-white/90 dark:bg-[#0b1528]/90 backdrop-blur-xl p-12 text-center rounded-2xl border border-sky-200/90 dark:border-sky-900/60 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-cyan-400 mx-auto flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('op_ready_title', 'Ready for Corridor Triage')}</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
              {t('op_ready_desc', 'Enter a train number or choose a quick preset above to query real-time downstream station boards and identify services exposed to potential delays.')}
            </p>
          </div>
        )}

        {/* Live Analysis Display */}
        {impact && incident && (
          <div className="space-y-6">
            
            {/* Top Grid: Incident Train + Downstream Exposure */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
              
              {/* Incident Train Telemetry Card */}
              <div className="bg-white/90 dark:bg-[#0b1528]/90 backdrop-blur-xl p-6 rounded-2xl border border-sky-200/90 dark:border-sky-900/60 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-sky-700 dark:text-cyan-400 font-mono font-bold">
                        {t('op_incident_telemetry', 'Incident Train Telemetry')}
                      </div>
                      <div className="text-3xl sm:text-4xl font-black font-mono text-slate-900 dark:text-white mt-1">
                        #{incident.train_number}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-200">{incident.current_station}</span>
                        <span>➔</span>
                        <span>{incident.next_station || 'Terminal'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {incident.halt_status === 'halted' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/50">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          {t('op_halted', 'HALTED')}
                        </span>
                      ) : incident.delay_minutes > 15 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/50">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          +{incident.delay_minutes} MIN {t('dash_delayed', 'DELAY')}
                        </span>
                      ) : incident.delay_minutes > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          +{incident.delay_minutes} MIN {t('dash_delayed', 'DELAY')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/50">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {t('dash_on_schedule', 'ON SCHEDULE')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Downstream Corridor Path Ribbon */}
                  <div className="my-5 p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-2">
                      {t('op_downstream_halts', 'Downstream Monitored Corridor')} ({impact.affected_station_codes.length} Halts)
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
                      {impact.affected_station_codes.map((code, idx) => (
                        <React.Fragment key={code}>
                          <span className="px-2 py-1 rounded-lg bg-white dark:bg-[#071827] border border-sky-200 dark:border-cyan-500/40 text-slate-900 dark:text-cyan-300 font-bold shrink-0 shadow-2xs">
                            {code}
                          </span>
                          {idx < impact.affected_station_codes.length - 1 && (
                            <span className="text-slate-400 dark:text-slate-600 shrink-0">➔</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* 4-Stat Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">{t('op_movement_state', 'Movement State')}</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${incident.halt_status === 'halted' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className="capitalize">{incident.halt_status}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">{t('op_current_velocity', 'Current Velocity')}</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {incident.speed_kmh != null ? `${incident.speed_kmh} km/h` : '—'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">{t('op_journey_date', 'Journey Date')}</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-1 truncate">
                        {incident.journey_date}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">{t('op_signal_source', 'Signal Source')}</div>
                      <div className="text-xs font-bold text-sky-700 dark:text-cyan-300 mt-1 truncate">
                        {incident.provider}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{t('op_telemetry_observed', 'Telemetry observed:')}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{displayTime(incident.observed_at)} IST</span>
                </div>
              </div>

              {/* Downstream Train Exposure Table */}
              <div className="bg-white/90 dark:bg-[#0b1528]/90 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-sky-200/90 dark:border-sky-900/60 shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                        {t('op_downstream_title', 'Potential Downstream Exposure')}
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                        {impact.affected_trains.length} {t('op_services_count', 'Services in Corridor Window')}
                      </h2>
                    </div>
                    <div className="text-left sm:text-right text-xs text-slate-500 font-mono">
                      Board Correlation: <span className="font-bold text-slate-700 dark:text-slate-300">{impact.data_quality.provider}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 pr-4">{t('op_train_service', 'Train Service')}</th>
                          <th className="py-2.5 pr-4">{t('op_halt_station', 'Halt Station')}</th>
                          <th className="py-2.5 pr-4">{t('op_expected_eta', 'Expected ETA')}</th>
                          <th className="py-2.5 pr-4">{t('op_delay_state', 'Delay State')}</th>
                          <th className="py-2.5">{t('op_impact_vector', 'Impact Vector')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {impact.affected_trains.map((train, index) => (
                          <tr key={`${train.train_number}-${train.station_code}-${index}`} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 pr-4">
                              <div className="font-bold text-slate-900 dark:text-white">#{train.train_number}</div>
                              <div className="text-[11px] text-slate-500 max-w-[170px] truncate">{train.train_name}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-cyan-300 font-bold">
                                {train.station_code}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 tabular-nums">
                              {displayTime(train.expected_arrival || train.scheduled_arrival)}
                            </td>
                            <td className="py-3 pr-4">
                              {getDelayBadge(train.delay_minutes)}
                            </td>
                            <td className="py-3 text-[11px] text-slate-600 dark:text-slate-400 max-w-[220px] leading-relaxed">
                              {train.impact_reason.includes('occupied block') ? (
                                <span className="text-rose-600 dark:text-rose-400 font-medium">{t('op_block_contention', 'Occupied block contention')}</span>
                              ) : train.impact_reason.includes('maintenance') ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{t('op_maint_block', 'Maintenance block')}</span>
                              ) : (
                                <span>{t('op_downstream_window', 'Downstream station window')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {impact.affected_trains.length === 0 && (
                      <div className="py-10 text-center text-slate-500 text-xs font-mono">
                        {t('op_no_trains', 'No other trains were returned by the live boards in this lookahead corridor window.')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>{t('op_correlates_note', 'Note: Correlates live arrivals within downstream windows. Does not assume rigid physical interlock blockage.')}</span>
                </div>
              </div>

            </div>

            {/* Bottom Panel: System Telemetry Diagnostics & Health */}
            <div className="bg-white/90 dark:bg-[#0b1528]/90 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-sky-200/90 dark:border-sky-900/60 shadow-sm">
              <div className="text-xs uppercase font-mono font-bold tracking-wider text-sky-700 dark:text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t('op_diagnostics_title', 'Operational Data Diagnostics & Signal Quality')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">{t('op_occupancy_feed', 'Occupancy Feed')}</div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200">
                    <span className={`w-2 h-2 rounded-full ${impact.data_quality.network_signals_available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>
                      {impact.data_quality.network_signals_available
                        ? `${t('op_active', 'Active')} (${impact.data_quality.network_signal_provider || 'Provider'})`
                        : t('op_standby', 'Simulated / Standby')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">{t('op_causality_verif', 'Causality Verification')}</div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>{t('op_predictive_corr', 'Predictive Correlation')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">{t('op_station_board_health', 'Station Board Health')}</div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200">
                    <span className={`w-2 h-2 rounded-full ${impact.data_quality.failed_station_boards.length === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span>
                      {impact.data_quality.failed_station_boards.length === 0
                        ? t('op_all_boards_active', '100% Boards Active')
                        : `${impact.data_quality.failed_station_boards.length} ${t('op_offline', 'Offline')}`}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1729]/90 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">{t('op_telemetric_provider', 'Telemetric Provider')}</div>
                  <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-cyan-300 truncate">
                    <span>{impact.data_quality.provider}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
