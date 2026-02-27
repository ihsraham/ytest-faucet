'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      const shouldUseDark = storedTheme === 'dark';
      setIsDark(shouldUseDark);
      document.documentElement.classList.toggle('dark', shouldUseDark);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme}>
      {isDark ? 'Light mode' : 'Dark mode'}
    </Button>
  );
}
