'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [, startTransition] = useTransition();

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem('railpulse-theme') as Theme | null;
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        const initialTheme: Theme = stored === 'light' || stored === 'dark'
          ? stored
          : prefersDark ? 'dark' : 'light';
        setThemeState(initialTheme);
        applyTheme(initialTheme);
      } catch {
        // Fallback if localStorage is disabled
      }
    }, 0);

    const handleThemeChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ theme: Theme }>;
      const nextTheme = customEvt.detail?.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      setThemeState(nextTheme);
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    startTransition(() => {
      setThemeState(newTheme);
      applyTheme(newTheme);
      try {
        localStorage.setItem('railpulse-theme', newTheme);
      } catch {
        // Ignore storage failures
      }
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: newTheme } }));
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
