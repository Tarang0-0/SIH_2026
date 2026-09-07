'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MapRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const train = searchParams.get('train') || '';
  const date = searchParams.get('date') || '';

  useEffect(() => {
    const query = new URLSearchParams();
    if (train) query.set('train', train);
    if (date) query.set('date', date);
    router.replace(`/dashboard${query.toString() ? `?${query.toString()}` : ''}`);
  }, [router, train, date]);

  return null;
}
