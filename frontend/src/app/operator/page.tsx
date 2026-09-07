'use client';

import React, { useState } from 'react';
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

const indiaDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

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
  const [trainNumber, setTrainNumber] = useState('');
  const [journeyDate, setJourneyDate] = useState(indiaDate());
  const [lookahead, setLookahead] = useState('4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState<ImpactResponse | null>(null);

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
      const query = new URLSearchParams({ date: journeyDate, lookahead_stations: lookahead });
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

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-400 font-mono mb-3">Network control room</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Downstream impact monitor</h1>
          <p className="text-slate-400 mt-3 max-w-3xl">
            Inspect a live train and the other trains currently appearing on its downstream station boards.
            This is live operational correlation, not a confirmed track-blocking decision.
          </p>
        </div>

        <form onSubmit={analyzeImpact} className="panel-card p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end">
          <label className="text-xs text-slate-400 font-mono">
            Train number
            <input
              value={trainNumber}
              onChange={(event) => setTrainNumber(event.target.value)}
              placeholder="Enter a train number"
              inputMode="numeric"
              className="mt-2 w-full bg-[#070b14] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="text-xs text-slate-400 font-mono">
            Journey date
            <input
              type="date"
              value={journeyDate}
              onChange={(event) => setJourneyDate(event.target.value)}
              className="mt-2 w-full bg-[#070b14] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-cyan-400"
            />
          </label>
          <label className="text-xs text-slate-400 font-mono">
            Downstream stations
            <select
              value={lookahead}
              onChange={(event) => setLookahead(event.target.value)}
              className="mt-2 w-full bg-[#070b14] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
            {loading ? 'Analyzing…' : 'Analyze impact'}
          </button>
        </form>

        {error && <div className="mt-4 panel-card border-rose-400/30 p-4 text-sm text-rose-300">{error}</div>}

        {!impact && !loading && !error && (
          <div className="mt-8 panel-card p-10 text-center text-slate-400">
            Enter a train number to start a live downstream impact check.
          </div>
        )}

        {impact && incident && (
          <>
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-4">
              <div className="panel-card p-5">
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
