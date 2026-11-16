import { useState, type DragEvent } from 'react';
import { ImageUp, CheckCircle2 } from 'lucide-react';
import { useSchool } from '../../lib/school';
import { supabase, errorMessage } from '../../lib/supabase';
import { uploadToPath } from '../../lib/media';
import { ErrorBox } from '../../components/ui';

const TABLES = ['machines', 'materials', 'consumables', 'catalog_items', 'maintenance', 'incidents'];

interface Result { ok: number; exists: number; unmatched: string[]; failed: string[] }

/**
 * Importa les fotos exportades de l'AppSheet: cada registre importat ja té la ruta
 * de la seva foto (…/<RowID>.Fotografia.<n>.jpg). Aquí només cal triar els fitxers:
 * es fa coincidir pel nom, es comprimeixen i es pugen a la ruta que toca.
 */
export default function PhotoImport() {
  const { school, role } = useSchool();
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (role !== 'admin' || !school) return <p>Només l'administrador del centre pot importar fotos.</p>;

  async function run(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!images.length) return;
    setError(null); setResult(null);
    try {
      const paths = new Map<string, string>();
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select('photo_path').eq('school_id', school!.id).not('photo_path', 'is', null);
        if (error) throw error;
        for (const r of data ?? []) {
          const p = r.photo_path as string;
          paths.set(p.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase(), p);
        }
      }
      const res: Result = { ok: 0, exists: 0, unmatched: [], failed: [] };
      setProgress({ done: 0, total: images.length });
      let i = 0;
      const queue = [...images];
      const worker = async () => {
        while (queue.length) {
          const f = queue.shift()!;
          const path = paths.get(f.name.replace(/\.[^.]+$/, '').toLowerCase());
          if (!path) res.unmatched.push(f.name);
          else {
            try { (await uploadToPath(path, f)) === 'ok' ? res.ok++ : res.exists++; }
            catch (e) { res.failed.push(`${f.name}: ${errorMessage(e)}`); }
          }
          setProgress({ done: ++i, total: images.length });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      setResult(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); run([...e.dataTransfer.files]); };

  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">Administració</span>
          <h1>Importar fotos</h1>
          <p>Per portar les fotos de l'AppSheet: descarrega de Google Drive les carpetes <code>MÀQUINES_Images</code>, <code>MATERIALS_Images</code>, <code>CONSUMIBLES_Images</code>…, descomprimeix-les i arrossega-hi totes les imatges. Cada foto anirà sola al seu registre.</p>
        </div>
      </header>

      <div className={`drop ${over ? 'over' : ''}`} style={{ maxWidth: 720 }}
           onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <ImageUp size={32} strokeWidth={1.4} />
        <b>Arrossega aquí les fotos</b>
        <span className="muted small">o</span>
        <div className="row">
          <label className="btn btn-primary">Tria fitxers<input type="file" accept="image/*" multiple hidden onChange={(e) => run([...(e.target.files ?? [])])} /></label>
          <label className="btn">Tria una carpeta<input type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={(e) => run([...(e.target.files ?? [])])} /></label>
        </div>
        {progress && (
          <div style={{ width: '100%', maxWidth: 360 }} className="stack">
            <div className="progress"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            <span className="label">{progress.done} / {progress.total}</span>
          </div>
        )}
      </div>

      <ErrorBox error={error} />
      {result && (
        <div className="panel stack" style={{ maxWidth: 720, marginTop: 16 }}>
          <div className="row"><CheckCircle2 color="var(--ok)" /><b>{result.ok} fotos pujades</b></div>
          {result.exists > 0 && <span className="muted">{result.exists} ja hi eren i no s'han tornat a pujar.</span>}
          {result.unmatched.length > 0 && <span className="muted">{result.unmatched.length} no corresponen a cap registre: {result.unmatched.slice(0, 8).join(', ')}{result.unmatched.length > 8 ? '…' : ''}</span>}
          {result.failed.length > 0 && <span className="error-text">{result.failed.length} han fallat: {result.failed.slice(0, 3).join(' · ')}</span>}
        </div>
      )}
    </section>
  );
}
