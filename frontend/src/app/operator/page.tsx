'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
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
  const [authChecked, setAuthChecked] = useState(false);
  const [trainNumber, setTrainNumber] = useState('');
  const [lookahead, setLookahead] = useState('4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState<ImpactResponse | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
      router.replace('/admin/login?next=/operator');
      return;
    }
    const frameId = window.requestAnimationFrame(() => setAuthChecked(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [router]);

  const analyzeImpact = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = trainNumber.trim();
    if (!key) {
      setError('Enter a train number to inspect the live downstream impact.');
      return;
    }
    setLoading(true);
    setError('');
    setImpact(null);
    try {
      const query = new URLSearchParams({ lookahead_stations: lookahead });
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

  const incident = impact?.incident;
  const statusClass = incident?.halt_status === 'halted'
    ? 'badge-critical'
    : incident?.delay_minutes && incident.delay_minutes > 0
      ? 'badge-delayed'
      : 'badge-ontime';

  if (!authChecked) return <div className="min-h-screen bg-[#060a12]" />;

  return (
    <div className="min-h-screen bg-[#061521] text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/25">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-400 font-mono mb-3"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_8px_#00f0ff]" /> Admin only</div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Operations control room</h1>
            <p className="text-slate-400 mt-3 max-w-3xl leading-6">Monitor a train’s current movement and identify other services that may be exposed downstream. Use this view for operational triage, not as proof of a track blockage.</p>
          </div>
          <button type="button" onClick={() => { window.sessionStorage.removeItem(ADMIN_SESSION_KEY); router.replace('/admin/login?next=/operator'); }} className="self-start rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200 cursor-pointer">Sign out</button>
        </div>

        <form onSubmit={analyzeImpact} className="surface-3d border border-cyan-400/25 p-5 sm:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3.5 items-end shadow-2xl">
          <label className="text-xs text-slate-400 font-mono">
            Train to inspect
            <input
              value={trainNumber}
              onChange={(event) => setTrainNumber(event.target.value)}
              placeholder="Enter a train number (e.g. 12951)"
              inputMode="numeric"
              className="mt-2 w-full bg-[#071827]/80 border border-sky-200/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
            />
          </label>
          <label className="text-xs text-slate-400 font-mono">
            Look ahead
            <select
              value={lookahead}
              onChange={(event) => setLookahead(event.target.value)}
              className="mt-2 w-full bg-[#071827]/80 border border-sky-200/15 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} stations</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl px-6 py-2.5 text-sm transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] cursor-pointer">
            {loading ? 'Analyzing…' : 'Analyze impact'}
          </button>
        </form>

        {error && <div className="mt-4 surface-3d border border-rose-400/30 p-4 rounded-xl text-sm text-rose-300">{error}</div>}

        {!impact && !loading && !error && (
          <div className="mt-8 surface-3d p-12 text-center text-slate-400 rounded-2xl border border-white/[0.08]">
            Enter a train number above to start a live downstream impact check.
          </div>
        )}

        {impact && incident && (
          <>
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-4">
              <div className="surface-3d p-6 rounded-2xl border border-white/[0.08]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-mono">Incident train</div>
                    <div className="text-3xl font-black font-mono text-white mt-2">{incident.train_number}</div>
                    <div className="text-sm text-slate-400 mt-1">{incident.current_station} → {incident.next_station || 'Next station unavailable'}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${statusClass}`}>
                    {incident.halt_status === 'halted' ? 'HALTED' : `+${incident.delay_minutes} MIN`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
                  <div><div className="text-xs text-slate-500">Journey</div><div className="font-mono text-slate-200 mt-1">{incident.journey_date}</div></div>
                  <div><div className="text-xs text-slate-500">Speed</div><div className="font-mono text-slate-200 mt-1">{incident.speed_kmh ?? '—'} km/h</div></div>
                  <div><div className="text-xs text-slate-500">Provider</div><div className="font-mono text-slate-200 mt-1">{incident.provider}</div></div>
                  <div><div className="text-xs text-slate-500">Board stations</div><div className="font-mono text-slate-200 mt-1">{impact.affected_station_codes.join(', ')}</div></div>
                </div>
              </div>
              <div className="panel-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-mono">Potential downstream exposure</div>
                    <h2 className="text-xl font-bold text-white mt-1">{impact.affected_trains.length} train records</h2>
                  </div>
                  <div className="text-right text-xs text-slate-500 font-mono">Live board correlation<br />{impact.data_quality.provider}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/[0.08]">
                      <tr><th className="py-2 pr-4">Train</th><th className="py-2 pr-4">Station</th><th className="py-2 pr-4">Expected</th><th className="py-2">Delay</th></tr>
                    </thead>
                    <tbody>
                      {impact.affected_trains.map((train, index) => (
                        <tr key={`${train.train_number}-${train.station_code}-${index}`} className="border-b border-white/[0.05] last:border-0">
                          <td className="py-3 pr-4"><div className="font-mono font-bold text-white">{train.train_number}</div><div className="text-xs text-slate-500 max-w-[180px] truncate">{train.train_name}</div></td>
                          <td className="py-3 pr-4 font-mono text-cyan-300">{train.station_code}</td>
                          <td className="py-3 pr-4 font-mono text-slate-300">{displayTime(train.expected_arrival || train.scheduled_arrival)}</td>
                          <td className="py-3 font-mono text-amber-300">{train.delay_minutes == null ? '—' : `+${train.delay_minutes}m`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {impact.affected_trains.length === 0 && <div className="py-8 text-center text-slate-500">No other trains were returned by the live boards in this window.</div>}
                </div>
              </div>
            </section>
            <div className="mt-4 text-xs text-slate-500 font-mono">
              Occupancy feed: {impact.data_quality.network_signals_available ? `connected (${impact.data_quality.network_signal_provider || 'provider'})` : 'unavailable'} · Causality confirmed: no · Failed boards: {impact.data_quality.failed_station_boards.length ? impact.data_quality.failed_station_boards.join(', ') : 'none'}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
