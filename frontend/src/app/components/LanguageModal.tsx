'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage, type Language } from './LanguageContext';

export default function LanguageModal() {
  const { language, setLanguage, isLanguageModalOpen, closeLanguageModal } = useLanguage();
  const [selected, setSelected] = useState<Language>(language);

  // Sync candidate selection with active language when modal opens
  useEffect(() => {
    if (isLanguageModalOpen) {
      // Reset the draft only when the dialog opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(language);
    }
  }, [language, isLanguageModalOpen]);

  // Keyboard navigation: Escape to cancel, Enter to apply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLanguageModalOpen) return;
      if (e.key === 'Escape') {
        closeLanguageModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setLanguage(selected);
        closeLanguageModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLanguageModalOpen, selected, setLanguage, closeLanguageModal]);

  const handleApply = (langToSet?: Language) => {
    const chosen = langToSet || selected;
    setLanguage(chosen);
    closeLanguageModal();
  };

  const handleCancel = () => {
    setSelected(language);
    closeLanguageModal();
  };

  return (
    <AnimatePresence>
      {isLanguageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm"
        >
          {/* Backdrop Click Dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="absolute inset-0"
            aria-hidden="true"
          />

          {/* Clean Dialog Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1329] p-6 sm:p-7 shadow-2xl transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div>
                  <h2 id="language-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {selected === 'hi' ? 'भाषा का चयन करें' : 'Select Language'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                    RailTrackr • भारतीय रेल लाइव ट्रैकिंग
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close language selector"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              {selected === 'hi'
                ? 'वेबसाइट, लाइव ट्रेन ट्रैकिंग एवं डैशबोर्ड के लिए अपनी पसंदीदा भाषा चुनें।'
                : 'Select your preferred language for the interface, live telemetry, and transit dashboard.'}
            </p>

            {/* Language Selection List */}
            <div className="space-y-3 mb-6">
              {/* English Option */}
              <div
                role="radio"
                aria-checked={selected === 'en'}
                tabIndex={0}
                onClick={() => setSelected('en')}
                onDoubleClick={() => handleApply('en')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelected('en');
                  }
                }}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  selected === 'en'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                      selected === 'en'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    EN
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>English</span>
                      {selected === 'en' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Full platform in English with Indian Railways telemetry
                    </div>
                  </div>
                </div>

                {/* Radio Indicator */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    selected === 'en'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'border-2 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {selected === 'en' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Hindi Option */}
              <div
                role="radio"
                aria-checked={selected === 'hi'}
                tabIndex={0}
                onClick={() => setSelected('hi')}
                onDoubleClick={() => handleApply('hi')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelected('hi');
                  }
                }}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  selected === 'hi'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                      selected === 'hi'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    हिं
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>हिन्दी (Hindi)</span>
                      {selected === 'hi' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                          चयनित
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      संपूर्ण वेबसाइट, लाइव ट्रेन ट्रैकिंग एवं आगमन पूर्वानुमान
                    </div>
                  </div>
                </div>

                {/* Radio Indicator */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    selected === 'hi'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'border-2 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {selected === 'hi' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans">
                {selected === 'hi' ? 'नेविगेशन बार से कभी भी बदलें' : 'Switch anytime from navbar'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                >
                  {selected === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApply()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>{selected === 'hi' ? 'लागू करें' : 'Apply'}</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
