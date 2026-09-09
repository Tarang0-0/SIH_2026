'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import ThreeDHeroCanvas from './components/ThreeDHeroCanvas';
import TiltCard from './components/TiltCard';
import { apiUrl } from '../lib/api';

interface TrainSearchResult {
  train_number: string;
  train_name: string;
  origin: string;
  dest: string;
}

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrainSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError('');
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const timer = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError('');
      fetch(apiUrl(`/api/v1/trains/search?q=${encodeURIComponent(query)}`))
        .then((response) => {
          if (!response.ok) throw new Error('Train search is temporarily unavailable.');
          return response.json();
        })
        .then((data) => {
          setSearchResults(Array.isArray(data) ? data : []);
          setIsSearching(false);
        })
        .catch((error: unknown) => {
          setSearchResults([]);
          setIsSearching(false);
          setSearchError(error instanceof Error ? error.message : 'Train search is temporarily unavailable.');
        });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTrain = (trainNo: string) => {
    const typed = trainNo.trim();
    const selected = /^\d+$/.test(typed) ? typed : searchResults[0]?.train_number;
    if (selected) router.push(`/dashboard?train=${encodeURIComponent(selected)}`);
  };

  const canSearch = Boolean(searchQuery.trim()) && (
    searchResults.length > 0 || /^\d+$/.test(searchQuery.trim())
  );
  const showSuggestions = searchQuery.trim().length >= 2 && !isSearching && !searchError;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#eef2f7] bg-[radial-gradient(circle_at_50%_12%,rgba(14,165,233,0.07),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(71,85,105,0.08),transparent_38%)] font-sans text-slate-900 selection:bg-sky-500/20">
      <Navbar />

      <main className="flex-1">
        <section className="relative isolate flex min-h-[calc(100vh-4rem)] flex-col justify-center overflow-visible bg-transparent px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <ThreeDHeroCanvas />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-sky-400/10 blur-[130px]" />

          <div className="relative z-30 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                Live train tracking
              </div>
              <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-6xl">
                Find your train.
                <span className="block bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Know what happens next.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Search by train number or name to see its live location, upcoming station, expected arrival, and delay.
              </p>
            </div>

            <div className="flex w-full justify-center lg:justify-end">
              <TiltCard
                maxTilt={5}
                perspective={1300}
                allowOverflow
                className="min-h-[420px] w-full max-w-xl rounded-[2rem] border border-slate-300/90 bg-slate-50/95 p-7 shadow-[0_28px_80px_-18px_rgba(15,23,42,0.2),0_0_0_1px_rgba(255,255,255,0.8)] backdrop-blur-xl sm:min-h-[450px] sm:p-10"
              >
                <div className="flex h-full flex-col justify-center">
                  <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">RailPulse tracker</div>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Where is your train?</h2>
                    </div>
                    <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-flex">
                      Ready
                    </span>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSelectTrain(searchQuery);
                    }}
                    className="relative z-40"
                  >
                    <label htmlFor="landing-train-search" className="mb-2 block text-sm font-semibold text-slate-700">
                      Search train number or name
                    </label>
                    <div className="flex flex-col gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-inner transition-all focus-within:border-sky-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-500/15 sm:flex-row">
                      <div className="relative flex min-w-0 flex-1 items-center">
                        <span className="pl-3 pr-2 font-mono text-sm font-bold text-sky-600">#</span>
                        <input
                          id="landing-train-search"
                          type="text"
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Train number or name"
                          aria-label="Search train number or name"
                          className="w-full bg-transparent py-3 pr-8 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                        />
                        {isSearching ? (
                          <div className="absolute right-3 h-4 w-4 animate-spin rounded-full border-2 border-sky-600/30 border-t-sky-600" />
                        ) : searchQuery ? (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 text-xs font-bold text-slate-400 transition hover:text-slate-700"
                            aria-label="Clear search"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="submit"
                        disabled={!canSearch}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(2,132,199,0.25)] transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400"
                      >
                        Search
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>

                    {showSuggestions && (
                      <div role="listbox" aria-label="Train suggestions" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-100 rounded-2xl border border-slate-300 bg-white shadow-2xl ring-1 ring-slate-900/5">
                        {searchResults.map((train) => (
                          <button
                            key={train.train_number}
                            type="button"
                            role="option"
                            aria-selected="false"
                            onClick={() => {
                              setSearchQuery(train.train_number);
                              handleSelectTrain(train.train_number);
                            }}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-sky-50"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <span className="font-mono text-sky-700">{train.train_number}</span>
                                <span className="truncate font-medium text-slate-700">{train.train_name}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-slate-500">
                              {train.origin} <span className="px-1 text-sky-500">→</span> {train.dest}
                            </div>
                          </button>
                        ))}
                        {searchResults.length === 0 && (
                          <div className="px-4 py-4 text-sm text-slate-500">No matching train found.</div>
                        )}
                      </div>
                    )}

                    {searchError && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {searchError} Make sure the FastAPI service is running on port 8000.
                      </div>
                    )}
                  </form>

                  <div className="mt-8 grid grid-cols-3 gap-2 border-t border-slate-100 pt-6">
                    <div className="rounded-xl bg-sky-50/80 p-3 text-center">
                      <div className="text-lg" aria-hidden="true">⌖</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">Next station</div>
                    </div>
                    <div className="rounded-xl bg-amber-50/80 p-3 text-center">
                      <div className="text-lg" aria-hidden="true">◷</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">Delay status</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50/80 p-3 text-center">
                      <div className="text-lg" aria-hidden="true">▦</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">Station help</div>
                    </div>
                  </div>

                  <p className="mt-5 text-center text-xs text-slate-500">
                    Enter a train number for direct tracking, or choose a matching train from the suggestions.
                  </p>
                </div>
              </TiltCard>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-300/80 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-sm">
              <div className="text-sm font-bold text-slate-900">Live position</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">See where the train is right now on its route.</div>
            </div>
            <div className="rounded-2xl border border-slate-300/80 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-sm">
              <div className="text-sm font-bold text-slate-900">Upcoming station</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">Get the next stop and its expected arrival time.</div>
            </div>
            <div className="rounded-2xl border border-slate-300/80 bg-white/60 px-5 py-4 shadow-sm backdrop-blur-sm">
              <div className="text-sm font-bold text-slate-900">Delay clarity</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">Compare the assigned time with the latest estimate.</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/60 bg-transparent px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span className="font-bold text-slate-900">RailPulse</span>
            <span>Live train intelligence</span>
          </div>
          <div className="flex gap-5">
            <Link href="/dashboard" className="transition hover:text-sky-600">Live Operations</Link>
            <Link href="/operator" className="transition hover:text-sky-600">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
