import { useEffect, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useSchool } from '../../lib/school';
import { supabase, errorMessage } from '../../lib/supabase';
import { uploadLogo } from '../../lib/media';
import { applyBrand, BRAND_PRESETS, DEFAULT_ACCENT } from '../../lib/brand';
import { BrandMark } from '../../components/Layout';
import { ErrorBox, toast } from '../../components/ui';

export default function Centre() {
  const { school, role, reload } = useSchool();
  const [name, setName] = useState(school?.name ?? '');
  const [color, setColor] = useState(school?.brand_color ?? DEFAULT_ACCENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setName(school?.name ?? ''); setColor(school?.brand_color ?? DEFAULT_ACCENT); }, [school?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { applyBrand(color); }, [color]);                       // previsualització en directe
  useEffect(() => () => applyBrand(school?.brand_color ?? null), [school?.brand_color]); // en sortir, torna al desat

  if (role !== 'admin' || !school) return <p>Només l'administrador del centre pot canviar-ne la identitat.</p>;

  async function save(values: Record<string, unknown>, ok = 'Desat') {
    setBusy(true); setError(null);
    const { error } = await supabase.from('schools').update(values).eq('id', school!.id);
    setBusy(false);
    if (error) setError(errorMessage(error)); else { toast(ok); await reload(); }
  }

  async function pickLogo(file?: File) {
    if (!file) return;
    setBusy(true); setError(null);
    try { await save({ logo_path: await uploadLogo(school!.id, file) }, 'Logotip actualitzat'); }
    catch (e) { setError(errorMessage(e)); setBusy(false); }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">Administració</span>
          <h1>Identitat del centre</h1>
          <p>El nom, el color i el logotip es veuen a tota l'app per a tot el claustre.</p>
        </div>
      </header>

      <div className="stack" style={{ maxWidth: 640, gap: 16 }}>
        <div className="panel stack">
          <span className="label">Nom</span>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !name.trim() || name === school.name} onClick={() => save({ name: name.trim() })}>Desa</button>
          </div>
        </div>

        <div className="panel stack">
          <span className="label">Logotip</span>
          <div className="row" style={{ gap: 16 }}>
            <BrandMark size={64} />
            <label className="btn">
              <Upload />Puja una imatge
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
            {school.logo_path && <button className="btn btn-danger" disabled={busy} onClick={() => save({ logo_path: null }, 'Logotip tret')}><Trash2 />Treu</button>}
          </div>
          <small className="muted">Millor quadrat i amb fons transparent (PNG). Si no n'hi ha, es mostra la inicial del centre.</small>
        </div>

        <div className="panel stack">
          <span className="label">Color</span>
          <div className="swatches">
            {BRAND_PRESETS.map((c) => (
              <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color personalitzat" />
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || color === (school.brand_color ?? DEFAULT_ACCENT)} onClick={() => save({ brand_color: color })}>Desa el color</button>
            <span className="muted small">Mira com queden els botons i el menú abans de desar-lo.</span>
          </div>
        </div>
        <ErrorBox error={error} />
      </div>
    </section>
  );
}
