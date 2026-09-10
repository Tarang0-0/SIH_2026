'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    try {
      const consent = localStorage.getItem('railpulse-consent');
      if (!consent) {
        // Delay slightly for smooth non-jarring layout mounting
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // In case localStorage is blocked in incognito
      setVisible(false);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('railpulse-consent', 'accepted');
    } catch {}
    setVisible(false);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('railpulse-consent', 'dismissed');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Privacy and Cookie Storage Notice"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 transition-all duration-300 pointer-events-none"
    >
      <div className="max-w-4xl mx-auto pointer-events-auto rounded-2xl border border-sky-300/80 dark:border-sky-800/80 bg-white/95 dark:bg-[#091326]/95 backdrop-blur-xl shadow-2xl p-5 sm:p-6 text-slate-800 dark:text-slate-100 ring-1 ring-sky-950/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 pr-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 font-mono">
                {t('cookie_title', 'Data Minimization & Storage Notice')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('cookie_desc', 'Namaste Rail uses strictly functional local storage for theme settings and session state. We do not track you, profile your behavior, or use third-party advertising cookies. By using this service, you acknowledge our')}{' '}
              <Link
                href="/privacy"
                className="font-semibold text-sky-700 dark:text-sky-400 underline hover:text-sky-800 dark:hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                {t('cookie_privacy_link', 'Privacy Policy')}
              </Link>{' '}
              {t('cookie_and', 'and')}{' '}
              <Link
                href="/cookies"
                className="font-semibold text-sky-700 dark:text-sky-400 underline hover:text-sky-800 dark:hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                {t('cookie_storage_link', 'Storage Policy')}
              </Link>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            <Link
              href="/cookies"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              {t('cookie_learn_more', 'Learn More')}
            </Link>
            <button
              type="button"
              onClick={handleAccept}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {t('cookie_accept', 'Accept & Continue')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss cookie notice"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
