import { useMemo, useState, type FormEvent } from 'react';
import type { Field, Resource, Row } from '../resources';
import { useSchool } from '../lib/school';
import { supabase, errorMessage } from '../lib/supabase';
import { uploadMedia, useMediaUrl } from '../lib/media';
import { canDelete } from '../resources';
import { useAuth } from '../lib/auth';
import { ErrorBox, Modal } from './ui';
import type { RefOptions } from './useRefs';

interface Props {
  resource: Resource;
  row?: Row | null;         // null/undefined = nou
  preset?: Row;
  refs: RefOptions;
  onClose: () => void;
  onSaved: () => void;
}

function toInput(f: Field, v: unknown) {
  if (v == null) return f.type === 'bool' ? false : '';
  if (f.type === 'time') return String(v).slice(0, 5);
  return v;
}

export default function RecordForm({ resource, row, preset, refs, onClose, onSaved }: Props) {
  const { school, isStaff, role, members, enabled } = useSchool();
  const { email } = useAuth();
  const isNew = !row;
  const fields = resource.fields.filter((f) => (isStaff || !f.staffOnly) && (!f.module || enabled.has(f.module)));

  const initial = useMemo(() => {
    const v: Row = {};
    for (const f of fields) {
      const def = f.defaultMe ? email : f.default ? f.default() : undefined;
      v[f.name] = toInput(f, row ? row[f.name] : def);
    }
    return { ...v, ...(preset ?? {}) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [values, setValues] = useState<Row>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!school) return;
    setBusy(true); setError(null);
    const payload: Row = {};
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) { if (!isNew) payload[f.name] = null; continue; }
      let v = values[f.name];
      if (v === '' || v === undefined) v = null;
      if (f.type === 'number' && v != null) v = Number(v);
      if (f.type === 'email' && v) v = String(v).trim().toLowerCase();
      if (isNew && v === null) continue;   // deixa que s'apliquin els valors per defecte de la BD
      payload[f.name] = v;
    }
    try {
      const q = isNew
        ? supabase.from(resource.table).insert({ ...payload, school_id: school.id })
        : supabase.from(resource.table).update(payload).eq('id', row!.id);
      const { error, data } = await q.select('id');
      if (error) throw error;
      if (!isNew && !data?.length) throw new Error('No tens permís per modificar aquest registre.');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!row || !confirm(`Segur que vols esborrar aquest/a ${resource.singular}?`)) return;
    setBusy(true);
    const { error } = await supabase.from(resource.table).delete().eq('id', row.id);
    setBusy(false);
    if (error) setError(errorMessage(error)); else onSaved();
  }

  return (
    <Modal title={isNew ? `Nou: ${resource.singular}` : `Editar ${resource.singular}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => (
          <label key={f.name} className={`field ${f.type === 'textarea' ? 'field-wide' : ''} ${f.type === 'bool' ? 'field-bool' : ''}`}>
            <span className="field-label">{f.label}{f.required && <em> *</em>}</span>
            <Input field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} refs={refs} members={members.map((m) => m.email)} folder={resource.table} />
            {f.help && <small className="field-help">{f.help}</small>}
          </label>
        ))}
        <ErrorBox error={error} />
        <footer className="form-actions">
          {!isNew && canDelete(role) && <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Esborrar</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel·la</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Desant…' : 'Desa'}</button>
        </footer>
      </form>
    </Modal>
  );
}

function Input({ field: f, value, onChange, refs, members, folder }: {
  field: Field; value: any; onChange: (v: unknown) => void; refs: RefOptions; members: string[]; folder: string;
}) {
  const { lists, school } = useSchool();
  const req = f.required;
  switch (f.type) {
    case 'textarea':
      return <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req} rows={3} />;
    case 'number':
      return <input type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req} />;
    case 'date':
    case 'time':
    case 'url':
      return <input type={f.type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req} />;
    case 'email':
      return (
        <>
          <input type="email" list={`dl-${f.name}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req} />
          <datalist id={`dl-${f.name}`}>{members.map((m) => <option key={m} value={m} />)}</datalist>
        </>
      );
    case 'bool':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case 'select': {
      const opts = f.options ?? lists[f.list ?? ''] ?? [];
      const all = value && !opts.includes(value) ? [value, ...opts] : opts;
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req}>
          <option value="">—</option>
          {all.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'ref': {
      const opts = refs[f.name] ?? [];
      const visible = opts.filter((o) => o.active || o.id === value);
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req}>
          <option value="">—</option>
          {visible.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    }
    case 'photo':
    case 'file':
      return <Upload kind={f.type} value={value} onChange={onChange} schoolId={school!.id} folder={folder} />;
    default:
      return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={req} />;
  }
}

function Upload({ kind, value, onChange, schoolId, folder }: {
  kind: 'photo' | 'file'; value: string | null; onChange: (v: unknown) => void; schoolId: string; folder: string;
}) {
  const url = useMediaUrl(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true); setErr(null);
    try { onChange(await uploadMedia(schoolId, folder, file)); }
    catch (e) { setErr(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="upload">
      {value && kind === 'photo' && url && <img src={url} alt="" className="upload-preview" />}
      {value && kind === 'file' && url && <a href={url} target="_blank" rel="noreferrer">Veure document</a>}
      <input type="file" accept={kind === 'photo' ? 'image/*' : 'image/*,application/pdf'}
             capture={kind === 'photo' ? 'environment' : undefined}
             onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
      {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Treu</button>}
      {busy && <small>Pujant…</small>}
      {err && <small className="error-text">{err}</small>}
    </div>
  );
}
