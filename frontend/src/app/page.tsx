'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import TiltCard from './components/TiltCard';
import { Crosshair, Clock, Building2, ArrowRight } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { useLanguage } from './components/LanguageContext';

interface TrainSearchResult {
  train_number: string;
  train_name: string;
  origin: string;
  dest: string;
}

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrainSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );

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
    if (selected) {
      router.push(`/dashboard?train=${encodeURIComponent(selected)}&date=${encodeURIComponent(selectedDate)}`);
    }
  };

  const canSearch = Boolean(searchQuery.trim()) && (
    searchResults.length > 0 || /^\d+$/.test(searchQuery.trim())
  );
  const showSuggestions = searchQuery.trim().length >= 2 && !isSearching && !searchError;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f8fafc] dark:bg-[#070c18] font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-500/20">
      <Navbar />

      <main id="main-content" className="flex-1">
        <section className="relative flex min-h-[calc(100vh-5rem)] flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t('hero_live_badge')}
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-6xl">
                {t('hero_title_1')}
                <span className="block text-blue-600 dark:text-blue-400 mt-1">
                  {t('hero_title_2')}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg font-normal">
                {t('hero_desc')}
              </p>
            </div>

            <div className="flex w-full justify-center lg:justify-end">
              <TiltCard
                allowOverflow
                className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] p-6 sm:p-9 shadow-xl transition-colors"
              >
                <div className="flex h-full flex-col justify-center">
                  <div className="mb-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <div>
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{t('search_card_tag')}</div>
                      <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{t('search_card_title')}</h2>
                    </div>
                    <span className="hidden rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 sm:inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{t('search_card_ready')}</span>
                    </span>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSelectTrain(searchQuery);
                    }}
                    className="relative z-40"
                  >
                    <label htmlFor="landing-train-search" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('search_input_label')}
                    </label>
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-[#07101f] p-2 transition-all focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 sm:flex-row">
                      <div className="relative flex min-w-0 flex-1 items-center">
                        <span className="pl-3.5 pr-2.5 font-mono text-sm font-bold text-slate-400 dark:text-slate-500">#</span>
                        <input
                          id="landing-train-search"
                          type="text"
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder={t('search_input_placeholder')}
                          aria-label={t('search_input_label')}
                          className="w-full bg-transparent py-3 pr-8 text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        {isSearching ? (
                          <div className="absolute right-3 h-4 w-4 animate-spin rounded-full border-2 border-blue-600/30 dark:border-blue-400/30 border-t-blue-600 dark:border-t-blue-400" />
                        ) : searchQuery ? (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 cursor-pointer"
                            aria-label="Clear search"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="submit"
                        disabled={!canSearch}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:shadow transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none cursor-pointer"
                      >
                        <span>{t('search_btn')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {showSuggestions && (
                      <div role="listbox" aria-label="Train suggestions" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] shadow-xl">
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
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="font-mono text-blue-600 dark:text-blue-400">{train.train_number}</span>
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{train.train_name}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {train.origin} <span className="px-1 text-slate-400">→</span> {train.dest}
                            </div>
                          </button>
                        ))}
                        {searchResults.length === 0 && (
                          <div className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('search_no_results', 'No matching train found.')}
                          </div>
                        )}
                      </div>
                    )}

                    {searchError && (
                      <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                        {searchError} Check that the backend service is running and configured.
                      </div>
                    )}
                  </form>

                  <div className="mt-8 grid grid-cols-3 gap-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-6">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 text-center transition-colors flex flex-col items-center justify-center gap-1.5 cursor-default">
                      <Crosshair className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('next_station_badge')}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 text-center transition-colors flex flex-col items-center justify-center gap-1.5 cursor-default">
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('delay_status_badge')}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 text-center transition-colors flex flex-col items-center justify-center gap-1.5 cursor-default">
                      <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('station_help_badge')}</div>
                    </div>
                  </div>

                  <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {t('search_subtext')}
                  </p>
                </div>
              </TiltCard>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] px-5 py-4 shadow-xs transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">{t('feature_1_title')}</div>
              </div>
              <div className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{t('feature_1_desc')}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] px-5 py-4 shadow-xs transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">{t('feature_2_title')}</div>
              </div>
              <div className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{t('feature_2_desc')}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] px-5 py-4 shadow-xs transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">{t('feature_3_title')}</div>
              </div>
              <div className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{t('feature_3_desc')}</div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
