'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { useLanguage } from './LanguageContext';
import Logo from './Logo';

interface NavbarProps {
  theme?: 'dark' | 'light';
}

export default function Navbar({ theme = 'dark' }: NavbarProps) {
  void theme;
  const pathname = usePathname();
  const { language, openLanguageModal, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [indiaClock, setIndiaClock] = useState('');

  useEffect(() => {
    const updateClock = () => {
      setIndiaClock(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    };
    updateClock();
    const clockTimer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const navLinks = [
    { href: '/', label: t('nav_home', 'Home'), isOperator: false },
    { href: '/operator', label: t('nav_control_room', 'Control Room'), isOperator: true },
  ];

  return (
    <header className="sticky top-0 z-50 w-full max-w-7xl mx-auto p-2 sm:p-3 sm:mt-2 transition-all duration-300">
      <div className="relative bg-white/85 dark:bg-[#070e1c]/80 backdrop-blur-xl px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-white/90 dark:border-sky-800/50 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.7)] flex items-center justify-between transition-all duration-300">
        
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-2 focus-visible:outline-blue-500 rounded-xl shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 dark:from-sky-500/20 dark:to-blue-600/30 border border-blue-200/80 dark:border-sky-500/40 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-all duration-200">
            <Logo variant="icon" size="md" priority className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight block leading-tight">
              <span className="text-slate-900 dark:text-white">Rail</span>
              <span className="text-blue-600 dark:text-sky-400">Trackr</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-medium hidden lg:block">
              {t('brand_tagline')}
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links with Differentiated Shaded Pill Buttons - Centered in Middle */}
        <nav aria-label="Main Navigation" className="hidden md:flex md:absolute md:left-1/2 md:-translate-x-1/2 items-center gap-2 p-1.5 rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/70 shadow-inner z-10">
          {/* Home Button */}
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              pathname === '/'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/90 dark:border-slate-700 font-bold'
                : 'bg-white/60 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs'
            }`}
          >
            <span>{t('nav_home', 'Home')}</span>
          </Link>

          {/* Control Room Button */}
          <Link
            href="/operator"
            className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              pathname.startsWith('/operator')
                ? 'bg-blue-600 text-white shadow-sm border border-blue-700 dark:border-blue-500 font-bold'
                : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-300/80 dark:hover:bg-slate-700 hover:text-slate-950 dark:hover:text-white border border-slate-300/70 dark:border-slate-700/80 shadow-2xs'
            }`}
          >
            <span>{t('nav_control_room', 'Control Room')}</span>
          </Link>
        </nav>

        {/* Right Section: Clock, Language, Theme, and Signature CTA */}
        <div className="hidden md:flex items-center gap-3">
          {/* India Clock */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-300 font-mono shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('nav_ist')}</span>
            <time className="tabular-nums font-bold">{indiaClock || '--:--:--'}</time>
          </div>

          {/* Language Switcher Pill: Shows Currently Selected Language */}
          <button
            type="button"
            onClick={openLanguageModal}
            title={t('nav_lang_title')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-slate-700 transition shadow-2xs cursor-pointer"
          >
            <span className="text-sm" aria-hidden="true">🌐</span>
            <span>{language === 'hi' ? 'हिन्दी' : 'English'}</span>
          </button>

          <ThemeToggle />
        </div>

        {/* Mobile Actions & Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={openLanguageModal}
            title={t('nav_lang_title')}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 shadow-2xs"
          >
            🌐 {language === 'hi' ? 'हिन्दी' : 'English'}
          </button>
          
          <ThemeToggle />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white/80 dark:bg-slate-900/80 shadow-2xs"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="md:hidden mt-2 p-3 space-y-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/70 bg-white/95 dark:bg-[#070c18]/95 backdrop-blur-2xl shadow-xl transition-all"
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href.split('?')[0]));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-2xs ${
                  link.isOperator
                    ? isActive
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700/60'
                    : isActive
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-slate-700 font-bold'
                      : 'bg-white/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('nav_ist')}</span>
              <time className="font-mono text-xs font-bold tabular-nums">{indiaClock || '--:--:--'}</time>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
