'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { MercuryLogin } from '@/components/ui/mercury-login';
import { useLanguage } from '../../components/LanguageContext';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin@2026';
const ADMIN_SESSION_KEY = 'railpulse_admin_authenticated';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const requestedNextPath = searchParams.get('next');
  const nextPath =
    requestedNextPath?.startsWith('/') && !requestedNextPath.startsWith('//')
      ? requestedNextPath
      : '/operator';

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        router.replace(nextPath);
      }
    } catch {}
  }, [nextPath, router]);

  const handleLogin = ({ username, password }: { username: string; password: string }) => {
    setIsLoading(true);
    setError('');

    // Simulate short verification delay for high-tech biometric/neural effect
    setTimeout(() => {
      if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        try {
          window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        } catch {}
        router.replace(nextPath);
      } else {
        setIsLoading(false);
        setError(t('admin_auth_failed', 'Authentication sequence rejected. Check operator credentials (admin / admin@2026).'));
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans relative selection:bg-sky-500/25 transition-colors duration-300">
      <Navbar />

      <main id="main-content" className="flex-1 flex flex-col justify-center relative">
        <MercuryLogin
          onSubmit={handleLogin}
          error={error}
          isLoading={isLoading}
          defaultUsername=""
          title={t('admin_title', 'Namaste Rail')}
          subtitle={t('admin_subtitle', 'Indian Railways Transit Operations & Dispatch Console')}
          systemNode={t('admin_system_node', 'RailPulse Node: 0xIR-NDLS')}
          returnLink="/"
          returnLabel={t('admin_return_label', 'RETURN TO PASSENGER DIRECTORY')}
        />
      </main>

      <Footer />
    </div>
  );
}
