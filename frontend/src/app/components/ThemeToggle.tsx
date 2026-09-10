'use client';

import React from 'react';
import SwitchToggleThemeDemo from '@/components/ui/toggle-theme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  void showLabel;
  return (
    <div
      className={`relative inline-flex items-center rounded-xl border border-sky-200/80 bg-white/90 px-2.5 py-1 text-slate-700 shadow-xs transition-all duration-300 hover:border-sky-300 hover:bg-white dark:border-sky-800/60 dark:bg-sky-950/70 dark:text-slate-200 backdrop-blur-md ${className}`}
    >
      <SwitchToggleThemeDemo />
    </div>
  );
}
