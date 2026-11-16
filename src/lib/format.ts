export const fmtDate = (v: unknown) =>
  v ? new Date(String(v) + 'T00:00:00').toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export const fmtTime = (v: unknown) => (v ? String(v).slice(0, 5) : '');

export const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local

export const nowTime = () => new Date().toTimeString().slice(0, 5);

export function minutesBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export function fmtDuration(min: number | null) {
  if (min == null || min < 0) return '';
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}
