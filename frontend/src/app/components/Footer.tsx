'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from './LanguageContext';
import Logo from './Logo';

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 dark:from-sky-500/20 dark:to-blue-600/30 border border-blue-200/80 dark:border-sky-500/40 p-1 flex items-center justify-center shadow-xs">
              <Logo variant="icon" size="sm" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight">
                  <span className="text-slate-900 dark:text-white">Rail</span>
                  <span className="text-blue-600 dark:text-sky-400">Trackr</span>
                </span>
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
            © {currentYear} {t('footer_mit_license', 'RailTrackr Contributors • MIT License')}
          </div>
          <div className="text-center sm:text-right">
            {t('footer_independent_note', 'Independent student research prototype. Not affiliated with Ministry of Railways or IRCTC.')}
          </div>
        </div>
      </div>
    </footer>
  );
}
