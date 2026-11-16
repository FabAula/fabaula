import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'fabaula.theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* navegació privada */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

// Abans del primer render, perquè no parpellegi
applyTheme(initial());
