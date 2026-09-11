'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from './LanguageContext';

export interface TrainLiveLocationCardProps {
  trainNumber: string;
  trainName?: string;
  currentStationCode?: string;
  currentStationName?: string;
  delayMinutes: number;
  nextStationCode: string;
  nextStationName: string;
  scheduledArrival: string;
  predictedArrival: string;
  speedKmH?: number | null;
  distanceKmToNext?: number | null;
  routeProgressPercent?: number;
  isOpen: boolean;
  onClose: () => void;
  onCenterOnTrain?: () => void;
  className?: string;
}

export default function TrainLiveLocationCard({
  trainNumber,
  trainName = '',
  currentStationCode = '',
  delayMinutes,
  nextStationCode,
  nextStationName,
  scheduledArrival,
  predictedArrival,
  speedKmH,
  distanceKmToNext,
  isOpen,
  onClose,
  onCenterOnTrain,
  className = '',
}: TrainLiveLocationCardProps) {
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDelayed = delayMinutes > 0;
  const isSevere = delayMinutes >= 20;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className={`relative z-[500] w-full max-w-sm sm:max-w-md rounded-2xl border border-sky-300/70 dark:border-sky-700/80 bg-white/95 dark:bg-[#091224]/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,132,199,0.18)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-4 sm:p-5 text-slate-900 dark:text-slate-100 ${className}`}
        role="dialog"
        aria-labelledby="train-location-title"
      >
        {/* Header with Train Identity & Close */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-sky-100 dark:border-sky-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                <path d="M10.621.515C8.647.02 7.353.02 5.38.515c-.924.23-1.982.766-2.78 1.22C1.566 2.322 1 3.432 1 4.582V13.5A2.5 2.5 0 0 0 3.5 16h9a2.5 2.5 0 0 0 2.5-2.5V4.583c0-1.15-.565-2.26-1.6-2.849-.797-.453-1.855-.988-2.779-1.22ZM6.5 2h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1m-2 2h7A1.5 1.5 0 0 1 13 5.5v2A1.5 1.5 0 0 1 11.5 9h-7A1.5 1.5 0 0 1 3 7.5v-2A1.5 1.5 0 0 1 4.5 4m.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0m0 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2M4 5.5a.5.5 0 0 1 .5-.5h3v3h-3a.5.5 0 0 1-.5-.5zM8.5 8V5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="train-location-title" className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Train #{trainNumber}
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-cyan-300 border border-sky-300/60 dark:border-sky-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                  {t('card_live', 'LIVE')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[240px]">
                {trainName || t('card_train_name_unavailable', 'Train name unavailable')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close train status popup"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Delay Status Indicator Banner */}
        <div className="my-3">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isDelayed
                ? isSevere
                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                  isDelayed
                    ? isSevere
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isDelayed ? '⏱' : '✓'}
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase font-bold tracking-wider opacity-80">
                  {t('card_delay_status', 'Delay Status')}
                </div>
                <div className="text-base font-black font-mono">
                  {isDelayed ? `+${delayMinutes} ${t('card_delayed', 'min Delayed')}` : t('card_on_schedule', 'Running on Schedule')}
                </div>
              </div>
            </div>

            <span
              className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md uppercase ${
                isDelayed
                  ? isSevere
                    ? 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-950 dark:text-rose-300'
                    : 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-300'
                  : 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-300'
              }`}
            >
              {isDelayed ? (isSevere ? t('card_severe_delay', 'Severe Delay') : t('card_late', 'Late')) : t('card_on_time', 'On Time')}
            </span>
          </div>
        </div>

        {/* Next Station Timetable Breakdown */}
        <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-[#0d182d] border border-sky-200/70 dark:border-sky-800/70 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-sky-800 dark:text-cyan-400">
              {t('card_upcoming_station', 'Upcoming Station')}
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {nextStationCode}
            </span>
          </div>

          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {nextStationName}
          </div>

          {/* Timing Comparison Grid: Actual Scheduled vs Expected */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sky-200/50 dark:border-sky-800/50">
            {/* Scheduled Actual Timetable Time */}
            <div className="bg-white dark:bg-[#070e1c] p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <div className="text-[9px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                {t('card_actual_sched_time', 'Actual Scheduled Time')}
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                {scheduledArrival || '--:--'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {t('card_official_timetable', 'Official timetable')}
              </div>
            </div>

            {/* Expected Estimated Arrival Time */}
            <div className="bg-white dark:bg-[#070e1c] p-2.5 rounded-lg border border-sky-300/80 dark:border-sky-700">
              <div className="text-[9px] font-mono uppercase font-bold text-sky-700 dark:text-cyan-400 mb-0.5">
                {t('card_expected_arrival', 'Expected Arrival')}
              </div>
              <div className={`text-base sm:text-lg font-black font-mono ${
                isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {predictedArrival || '--:--'}
              </div>
              <div className="text-[10px] text-sky-700 dark:text-cyan-400 font-mono font-semibold">
                {isDelayed ? `+${delayMinutes}m shift` : t('card_on_target', 'On target')}
              </div>
            </div>
          </div>

          {/* Distance & Telemetry info */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1">
            <span>
              {distanceKmToNext !== null && distanceKmToNext !== undefined
                ? `${t('card_distance_to_stop', 'Distance to stop')}: ${distanceKmToNext.toFixed(1)} km`
                : currentStationCode
                ? `${t('card_last_station', 'Last station')}: ${currentStationCode}`
                : t('card_en_route', 'En route')}
            </span>
            <span>
              {speedKmH !== null && speedKmH !== undefined && speedKmH > 0
                ? `${t('card_speed', 'Speed')}: ${Math.round(speedKmH)} km/h`
                : t('card_rtis_active', 'RTIS GPS active')}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 mt-3 pt-2">
          {onCenterOnTrain && (
            <button
              type="button"
              onClick={onCenterOnTrain}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-bold font-mono bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="8" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
              <span>{t('card_center_on_train', 'Center on Train')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            {t('card_dismiss', 'Dismiss')}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
