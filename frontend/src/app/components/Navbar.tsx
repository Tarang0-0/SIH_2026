'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiUrl } from '../../lib/api';

interface ServiceStatus {
  status: string;
  models_active: boolean;
  live_provider_configured: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/health'))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) =>
        setServiceStatus({
          status: data.status || 'degraded',
          models_active: Boolean(data.models_active),
          live_provider_configured: Boolean(data.live_provider_configured),
        })
      )
      .catch(() => setServiceStatus(null));
  }, []);

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/dashboard', label: 'Live Operations' },
    { href: '/operator', label: 'Operator Room' },
    { href: '/features', label: 'Architecture' },
    { href: '/about', label: 'About SIH' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#070b14]/90 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/30 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/>
            </svg>
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span>RailPulse</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">CRIS Telemetry</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono hidden sm:block">Indian Railways Transit Intelligence</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Status Pill & CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-white/[0.08] text-[11px] font-mono text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                serviceStatus?.models_active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{serviceStatus?.models_active ? 'ML Core: Online' : 'Calibrated Mode'}</span>
          </div>

          <Link
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>Track Express</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg border border-white/[0.08]"
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
        <div className="md:hidden bg-[#0a0f1d] border-b border-white/[0.08] px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.04]"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/[0.08]">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg"
            >
              Track Live Express
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
