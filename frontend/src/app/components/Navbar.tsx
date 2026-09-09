'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  theme?: 'dark' | 'light';
}

export default function Navbar({ theme = 'dark' }: NavbarProps) {
  void theme;
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [indiaClock, setIndiaClock] = useState('');

  useEffect(() => {
    const updateClock = () => {
      setIndiaClock(new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date()));
    };
    updateClock();
    const clockTimer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/operator', label: 'Control Room' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-sky-50/90 dark:bg-[#070c18]/90 border-b border-sky-200/70 dark:border-sky-900/60 shadow-[0_4px_20px_-4px_rgba(14,116,144,0.08)] dark:shadow-[0_4px_25px_-4px_rgba(0,0,0,0.5)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-sky-400/20 to-blue-600/20 blur-sm group-hover:blur transition-all duration-300" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-400/40 flex items-center justify-center text-white shadow-[0_2px_10px_rgba(2,132,199,0.25)] group-hover:scale-105 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                <path d="M10.621.515C8.647.02 7.353.02 5.38.515c-.924.23-1.982.766-2.78 1.22C1.566 2.322 1 3.432 1 4.582V13.5A2.5 2.5 0 0 0 3.5 16h9a2.5 2.5 0 0 0 2.5-2.5V4.583c0-1.15-.565-2.26-1.6-2.849-.797-.453-1.855-.988-2.779-1.22ZM6.5 2h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1m-2 2h7A1.5 1.5 0 0 1 13 5.5v2A1.5 1.5 0 0 1 11.5 9h-7A1.5 1.5 0 0 1 3 7.5v-2A1.5 1.5 0 0 1 4.5 4m.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0m0 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2M4 5.5a.5.5 0 0 1 .5-.5h3v3h-3a.5.5 0 0 1-.5-.5zM8.5 8V5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5z"/>
              </svg>
            </div>
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
              <span>Namaste Rail</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-sky-400 hidden sm:block">Indian Railways Transit Intelligence</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-1 bg-sky-100/70 dark:bg-sky-950/60 border border-sky-200/70 dark:border-sky-800/60 p-1 rounded-xl">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white dark:bg-sky-900/80 text-sky-700 dark:text-sky-200 border border-sky-200/80 dark:border-sky-700/60 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-sky-900/40'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Live India clock and Theme Toggle */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-white/85 dark:bg-sky-950/70 px-3.5 py-1.5 text-slate-700 dark:text-slate-200 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-400">IST</span>
            <time className="font-mono text-xs font-bold tabular-nums" aria-label="Current India time">
              {indiaClock || '--:--:--'}
            </time>
          </div>
          <ThemeToggle />
        </div>

        {/* Mobile Menu & Toggle Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-sky-200 dark:border-sky-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-sky-950 shadow-xs"
            aria-label="Toggle Navigation Menu"
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
        <div className="md:hidden border-b border-sky-200 dark:border-sky-800/70 px-4 pt-2 pb-4 space-y-1 bg-sky-50/98 dark:bg-[#070c18]/98 backdrop-blur-2xl shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-sky-950 px-3 py-2 text-slate-700 dark:text-slate-200 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-400">India time</span>
              <time className="font-mono text-xs font-bold tabular-nums">{indiaClock || '--:--:--'}</time>
            </div>
            <ThemeToggle showLabel className="shrink-0" />
          </div>
        </div>
      )}
    </header>
  );
}
