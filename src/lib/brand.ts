/** Aplica el color del centre com a accent de tota la interfície */
export const DEFAULT_ACCENT = '#0071e3';

export const BRAND_PRESETS = [
  '#0071e3', '#1d1d1f', '#1f6f5c', '#2d5ea8', '#5b4bc4', '#b0306f', '#c43d32', '#d0661d', '#b38a00', '#3f7d20', '#0f7c90',
];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function inkFor(hex: string) {
  return luminance(hex) > 0.45 ? '#0c0c0b' : '#ffffff';
}

export function applyBrand(color: string | null) {
  const c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_ACCENT;
  const root = document.documentElement.style;
  root.setProperty('--accent', c);
  root.setProperty('--accent-ink', inkFor(c));
  root.setProperty('--accent-soft', c + '14');
}
