'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/components/LanguageContext';

interface BlobConfig {
  size: number;
  left: number;
  top: number;
  animationDelay: number;
  animationDuration: number;
}

const deterministicBlobs: BlobConfig[] = [
  { size: 280, left: 12, top: 18, animationDelay: -5, animationDuration: 22 },
  { size: 320, left: 68, top: 12, animationDelay: -12, animationDuration: 26 },
  { size: 240, left: 32, top: 58, animationDelay: -8, animationDuration: 19 },
  { size: 300, left: 78, top: 62, animationDelay: -16, animationDuration: 25 },
  { size: 210, left: 8, top: 72, animationDelay: -3, animationDuration: 21 },
  { size: 260, left: 48, top: 28, animationDelay: -10, animationDuration: 24 },
];

export interface MercuryLoginProps {
  onSubmit?: (credentials: { username: string; password: string }) => void;
  error?: string;
  isLoading?: boolean;
  defaultUsername?: string;
  title?: string;
  subtitle?: string;
  systemNode?: string;
  returnLink?: string;
  returnLabel?: string;
}

export const MercuryLogin: React.FC<MercuryLoginProps> = ({
  onSubmit,
  error,
  isLoading = false,
  defaultUsername = '',
  title,
  subtitle,
  systemNode,
  returnLink = '/',
  returnLabel,
}) => {
  const { t } = useLanguage();
  const displayTitle = title || t('admin_title', 'RailTrackr');
  const displaySubtitle = subtitle || t('admin_subtitle', 'Indian Railways Transit Operations & Dispatch Console');
  const displaySystemNode = systemNode || t('admin_system_node', 'RailPulse Node: 0xIR-NDLS');
  const displayReturnLabel = returnLabel || t('admin_return_label', 'RETURN TO PASSENGER DIRECTORY');
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;

      blobRefs.current.forEach((blob, index) => {
        if (blob) {
          const speed = (index + 1) * 24;
          blob.style.marginLeft = `${x * speed}px`;
          blob.style.marginTop = `${y * speed}px`;
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ username, password });
    }
  };

  return (
    <div className="mercury-wrapper relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center transition-colors duration-300">
      <style>{`
        .mercury-wrapper {
          --mercury-blob-light: linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(37, 99, 235, 0.35));
          --mercury-blob-dark: linear-gradient(135deg, rgba(56, 189, 248, 0.45), rgba(14, 116, 144, 0.4));
          --filter-goo: url('#gooey-mercury');
        }

        .stage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          filter: var(--filter-goo);
          pointer-events: none;
        }

        .mercury-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(28px);
          animation: float-mercury 22s infinite alternate ease-in-out;
          transition: margin 0.15s ease-out;
        }

        @keyframes float-mercury {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(6vw, 12vh) scale(1.18); }
          66% { transform: translate(-4vw, 8vh) scale(0.85); }
          100% { transform: translate(4vw, -8vh) scale(1.1); }
        }

        .auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 480px;
        }

        .form-group {
          position: relative;
          margin-bottom: 24px;
          transition: transform 0.35s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .form-group:focus-within {
          transform: translateX(6px);
        }

        .input-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0%;
          height: 2px;
          transition: width 0.5s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .form-group input:focus + .input-glow {
          width: 100%;
        }

        .submit-wrap {
          margin-top: 32px;
          position: relative;
        }

        .mercury-drop {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          transform: translate(-50%, -50%);
          z-index: 1;
          border-radius: 9999px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .submit-wrap:hover .mercury-drop {
          transform: translate(-50%, -50%) scale(1.03, 1.15);
        }
      `}</style>

      {/* SVG Gooey Filter Definition */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="gooey-mercury">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Background Liquid Physics Stage */}
      <div className="stage opacity-60 dark:opacity-75" aria-hidden="true">
        {deterministicBlobs.map((data, index) => (
          <div
            key={index}
            ref={(el) => {
              blobRefs.current[index] = el;
            }}
            className="mercury-blob bg-gradient-to-br from-sky-400/40 via-blue-500/30 to-indigo-600/30 dark:from-sky-400/30 dark:via-blue-600/30 dark:to-cyan-400/25 shadow-xl"
            style={{
              width: `${data.size}px`,
              height: `${data.size}px`,
              left: `${data.left}%`,
              top: `${data.top}%`,
              animationDelay: `${data.animationDelay}s`,
              animationDuration: `${data.animationDuration}s`,
            }}
          />
        ))}
      </div>

      {/* Card Interface */}
      <main className="auth-container px-4 py-8 sm:px-6 w-full">
        <div className="rounded-3xl border border-sky-200/90 dark:border-sky-800/80 bg-white/85 dark:bg-[#081022]/90 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_24px_70px_-12px_rgba(15,23,42,0.15)] dark:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/60 dark:ring-sky-400/10 transition-all">
          
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate-700 dark:text-slate-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {displaySystemNode}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300">
                {t('admin_restricted', 'RESTRICTED')}
              </span>
            </div>

            <h1 className="font-black text-3xl sm:text-4xl tracking-tight text-slate-900 dark:text-white leading-none">
              {displayTitle}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              {displaySubtitle}
            </p>
          </header>

          {/* Form */}
          <form autoComplete="off" onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label htmlFor="mercury-username" className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                {t('admin_username', 'USERNAME')}
              </label>
              <div className="relative">
                <input
                  id="mercury-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('admin_username_placeholder', 'Enter username')}
                  required
                  autoComplete="username"
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white py-2.5 px-3 rounded-xl text-sm outline-none font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="mercury-password" className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                {t('admin_password', 'PASSWORD')}
              </label>
              <div className="relative">
                <input
                  id="mercury-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('admin_password_placeholder', 'Enter password')}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white py-2.5 px-3 rounded-xl text-sm outline-none font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/60 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2.5 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs font-mono uppercase tracking-wider transition-colors shadow-xs hover:shadow disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? t('admin_submitting', 'SUBMITTING…') : t('admin_submit', 'SUBMIT')}
              </button>
            </div>
          </form>

          {/* Footer Navigation */}
          <footer className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <Link
              href={returnLink}
              className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-sky-500 rounded"
            >
              <span aria-hidden="true">←</span>
              <span>{displayReturnLabel}</span>
            </Link>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {t('admin_secure_session', 'SECURE SHA-256 SESSION')}
            </span>
          </footer>

        </div>
      </main>
    </div>
  );
};

export default MercuryLogin;
