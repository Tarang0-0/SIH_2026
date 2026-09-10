'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer
      role="contentinfo"
      aria-label="Site Footer"
      className="mt-auto border-t border-sky-200/60 dark:border-sky-900/50 bg-white/75 dark:bg-[#060b17]/85 backdrop-blur-xl text-slate-600 dark:text-slate-400 py-4 sm:py-5 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-300/40 flex items-center justify-center text-white shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M10.621.515C8.647.02 7.353.02 5.38.515c-.924.23-1.982.766-2.78 1.22C1.566 2.322 1 3.432 1 4.582V13.5A2.5 2.5 0 0 0 3.5 16h9a2.5 2.5 0 0 0 2.5-2.5V4.583c0-1.15-.565-2.26-1.6-2.849-.797-.453-1.855-.988-2.779-1.22ZM6.5 2h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1m-2 2h7A1.5 1.5 0 0 1 13 5.5v2A1.5 1.5 0 0 1 11.5 9h-7A1.5 1.5 0 0 1 3 7.5v-2A1.5 1.5 0 0 1 4.5 4m.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0m0 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2M4 5.5a.5.5 0 0 1 .5-.5h3v3h-3a.5.5 0 0 1-.5-.5zM8.5 8V5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white">{t('brand_name', 'Namaste Rail')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-cyan-300 font-medium">SIH 2026</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {t('brand_tagline', 'Indian Railways Transit Intelligence & Live Telemetry')}
              </p>
            </div>
          </div>

          {/* Clean Horizontal Links */}
          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
            <Link
              href="/"
              className="hover:text-sky-600 dark:hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-sky-500 rounded transition-colors"
            >
              {t('nav_home', 'Home')}
            </Link>
            <Link
              href="/operator"
              className="hover:text-sky-600 dark:hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-sky-500 rounded transition-colors"
            >
              {t('nav_control_room')}
            </Link>
            <Link
              href="/terms"
              className="hover:text-sky-600 dark:hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-sky-500 rounded transition-colors"
            >
              {t('footer_terms_privacy', 'Terms & Privacy')}
            </Link>
            <a
              href="https://github.com/Tarang0-0/SIH_2026"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-sky-600 dark:hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-sky-500 rounded transition-colors"
              aria-label="GitHub Repository (opens in new tab)"
            >
              <span>GitHub</span>
              <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </nav>
        </div>

        {/* Minimal Bottom Line */}
        <div className="mt-3.5 pt-3 border-t border-sky-100 dark:border-sky-900/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <div>
            © {currentYear} {t('footer_mit_license', 'Namaste Rail Contributors • MIT License')}
          </div>
          <div className="text-center sm:text-right">
            {t('footer_independent_note', 'Independent student research prototype. Not affiliated with Ministry of Railways or IRCTC.')}
          </div>
        </div>
      </div>
    </footer>
  );
}
