import { useEffect, useState, type ReactNode } from 'react';
import { ImageOff, X, type LucideIcon } from 'lucide-react';
import type { Tone } from '../resources';
import { useMediaUrl } from '../lib/media';

/** Estat amb punt de color (dins de taules, targetes, fitxes) */
export function Status({ tone = 'muted', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`status status-${tone} ${className}`}>{children}</span>;
}

/** Etiqueta de pastilla amb fons suau */
export function Pill({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children, wide, hero }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; hero?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {hero ? (
          <div className="modal-hero">
            {hero}
            <button className="icon-btn" onClick={onClose} aria-label="Tanca"><X /></button>
          </div>
        ) : (
          <header className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Tanca"><X /></button>
          </header>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Foto que omple el contenidor (cover); si no n'hi ha, mostra la icona */
export function Photo({ path, icon: Icon = ImageOff, alt = '' }: { path?: string | null; icon?: LucideIcon; alt?: string }) {
  const url = useMediaUrl(path);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [path]);
  if (path && url && !broken) return <img src={url} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  return <div className="photo-ph"><Icon /></div>;
}

export function Thumb({ path, size = 40 }: { path?: string | null; size?: number }) {
  const url = useMediaUrl(path);
  return url
    ? <img className="thumb" src={url} alt="" style={{ width: size, height: size }} loading="lazy" />
    : <span className="thumb" style={{ width: size, height: size, display: 'inline-block' }} />;
}

export function Spinner() {
  return <div className="spinner" aria-label="Carregant" />;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error-box" role="alert">{error}</div>;
}

export function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="empty"><Icon strokeWidth={1.4} /><span>{children}</span></div>;
}

/** Missatges breus a la part de baix */
let pushToast: (m: string) => void = () => {};
export const toast = (m: string) => pushToast(m);

export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string }[]>([]);
  useEffect(() => {
    pushToast = (m) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, m }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
    };
  }, []);
  return <div className="toaster">{items.map((i) => <div key={i.id} className="toast">{i.m}</div>)}</div>;
}
