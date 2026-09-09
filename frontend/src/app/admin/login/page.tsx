'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin@2026';
const ADMIN_SESSION_KEY = 'railpulse_admin_authenticated';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNextPath = searchParams.get('next');
  const nextPath = requestedNextPath?.startsWith('/') && !requestedNextPath.startsWith('//')
    ? requestedNextPath
    : '/operator';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') router.replace(nextPath);
  }, [nextPath, router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      router.replace(nextPath);
    } else {
      setError('Incorrect admin username or password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#061521] text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/25">
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-[11px] font-mono uppercase tracking-widest text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Restricted access
            </div>
            <h1 className="mt-4 text-3xl font-black text-white">Admin Control Room</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to inspect downstream train impact and operational data quality.</p>
          </div>
          <form onSubmit={handleSubmit} className="surface-3d border border-white/[0.1] p-6 sm:p-8 rounded-2xl shadow-2xl">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-sky-200/15 bg-[#071827]/80 px-3.5 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50" placeholder="Enter admin username" required />
            </label>
            <label className="mt-4 block text-xs font-mono uppercase tracking-wider text-slate-400">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-sky-200/15 bg-[#071827]/80 px-3.5 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50" placeholder="Enter admin password" required />
            </label>
            {error && <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
            <button type="submit" className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-3 text-sm font-bold text-slate-950 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] cursor-pointer">Sign in to control room</button>
            <Link href="/" className="mt-4 block text-center text-xs font-mono text-slate-400 transition hover:text-cyan-300">Return to passenger search</Link>
          </form>
          <p className="mt-4 text-center text-[11px] font-mono text-slate-500">Prototype admin access • credentials: admin / admin@2026</p>
        </div>
      </main>
    </div>
  );
}
