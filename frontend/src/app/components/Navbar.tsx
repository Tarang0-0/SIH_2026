'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-sky-50/90 border-b border-sky-200/70 shadow-[0_4px_20px_-4px_rgba(14,116,144,0.08)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-sky-400/20 to-blue-600/20 blur-sm group-hover:blur transition-all duration-300" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 border border-sky-400/40 flex items-center justify-center text-white shadow-[0_2px_10px_rgba(2,132,199,0.25)] group-hover:scale-105 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/>
              </svg>
            </div>
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight flex items-center gap-2 text-slate-900">
              <span>RailPulse</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 hidden sm:block">Indian Railways Transit Intelligence</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-1 bg-sky-100/70 border border-sky-200/70 p-1 rounded-xl">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-sky-700 border border-sky-200/80 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Live India clock */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white/85 px-3.5 py-1.5 text-slate-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">IST</span>
            <time className="font-mono text-xs font-bold tabular-nums" aria-label="Current India time">
              {indiaClock || '--:--:--'}
            </time>
          </div>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg border border-sky-200 text-slate-700 hover:text-slate-900 bg-white shadow-xs"
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-sky-200 px-4 pt-2 pb-4 space-y-1 bg-sky-50/98 backdrop-blur-2xl shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:text-sky-700 hover:bg-sky-50"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <div className="flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">India time</span>
              <time className="font-mono text-xs font-bold tabular-nums">{indiaClock || '--:--:--'}</time>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
