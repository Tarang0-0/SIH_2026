'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { MercuryLogin } from '@/components/ui/mercury-login';
import { useLanguage } from '../../components/LanguageContext';
import { apiUrl } from '../../../lib/api';

const ADMIN_TOKEN_KEY = 'railpulse_admin_token';

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
      if (window.sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
        router.replace(nextPath);
      }
    } catch {}
  }, [nextPath, router]);

  const handleLogin = async ({ username, password }: { username: string; password: string }) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/v1/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.access_token !== 'string' || !body.access_token) {
        throw new Error(body.detail || 'Authentication failed. Verify the operator credentials.');
      }
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, body.access_token);
      router.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('admin_auth_failed', 'Authentication sequence rejected.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans relative selection:bg-sky-500/25 transition-colors duration-300">
      <Navbar />

      <main id="main-content" className="flex-1 flex flex-col justify-center relative pb-24">
        <MercuryLogin
          onSubmit={handleLogin}
          error={error}
          isLoading={isLoading}
          defaultUsername=""
          title={t('admin_title', 'RailTrackr')}
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
