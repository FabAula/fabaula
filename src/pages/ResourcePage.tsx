import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, SearchX } from 'lucide-react';
import {
  canCreate, canEdit, resourceByKey, type Field, type Resource, type Row, type RowAction, type ActionCtx,
} from '../resources';
import { useSchool } from '../lib/school';
import { useAuth } from '../lib/auth';
import { supabase, errorMessage } from '../lib/supabase';
import { fmtDate, fmtTime, nowTime } from '../lib/format';
import { useRefs, type RefOptions } from '../components/useRefs';
import RecordForm from '../components/RecordForm';
import { ErrorBox, Modal, Photo, Spinner, Status, Thumb, Empty, toast } from '../components/ui';
import { MODULE_ICON, RESOURCE_ICON } from '../icons';

type FormState = { resource: Resource; row?: Row; preset?: Row } | null;

export default function ResourcePage() {
  const { key = '' } = useParams();
  const res = resourceByKey(key);
  if (!res) return <p>Pantalla no trobada.</p>;
  return <ResourceView key={res.key} res={res} />;
}

function ResourceView({ res }: { res: Resource }) {
  const { school, role, isStaff, readOnly, enabled } = useSchool();
  const { email } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<number | null>(res.defaultFilter ?? null);
  const [cat, setCat] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const Icon = RESOURCE_ICON[res.key] ?? MODULE_ICON[res.module];

  const related = useMemo(() => [res, ...(res.actions ?? [])
    .map((a) => (a.kind === 'create' ? resourceByKey(a.resource) : a.kind === 'finish-use' ? resourceByKey('usos') : undefined))], [res]);
  const { refs, label, reloadRefs } = useRefs(related, school?.id);

  const load = useCallback(async () => {
    if (!school) return;
    setLoading(true); setError(null);
    let q = supabase.from(res.view ?? res.table).select('*').eq('school_id', school.id);
    for (const o of res.order) q = q.order(o.column, { ascending: o.ascending, nullsFirst: false });
    const { data, error } = await q.limit(1000);
    if (error) setError(errorMessage(error)); else setRows(data ?? []);
    setLoading(false);
  }, [school?.id, res]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.get('nou') && canCreate(res, role) && !readOnly) {
      setForm({ resource: res });
      params.delete('nou'); setParams(params, { replace: true });
    }
  }, [params, res, role, readOnly, setParams]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    const f = filter != null ? res.filters![filter] : null;
    return rows.filter((r) => (!f || f.match(r)) && (!cat || r.category === cat) && (!s || res.search(r).toLowerCase().includes(s)));
  }, [rows, search, filter, cat, res]);

  // Categories (només a les vistes de targetes): ajuden a trobar "el robot que tens davant"
  const cats = useMemo(() => res.card
    ? [...new Set(rows.map((r) => r.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ca'))
    : [], [rows, res]);

  if (!enabled.has(res.module)) return <Empty icon={Icon}>Aquest mòdul no està activat al teu centre.</Empty>;

  const ctx: ActionCtx = { role, email, isStaff };
  const visibleActions = (r: Row) => readOnly ? [] : (res.actions ?? []).filter((a) =>
    a.show(r, ctx) && (a.kind !== 'create' || canCreate(resourceByKey(a.resource)!, role)) && (a.kind !== 'finish-use' || role));

  async function runAction(a: RowAction, row: Row) {
    setDetail(null);
    if (a.kind === 'create') setForm({ resource: resourceByKey(a.resource)!, preset: a.preset(row) });
    else if (a.kind === 'edit') setForm({ resource: res, row, preset: a.preset(row) });
    else if (a.kind === 'finish-use') {
      const { data } = await supabase.from('machine_uses').select('*').eq('machine_id', row.id).is('end_time', null)
        .order('created_at', { ascending: false }).limit(1);
      const use = data?.[0];
      if (!use) { toast('No hi ha cap ús obert per a aquesta màquina'); return load(); }
      if (!canEdit(resourceByKey('usos')!, use, role, email)) { toast(`L'està fent servir ${use.user_email}`); return; }
      setForm({ resource: resourceByKey('usos')!, row: use, preset: { end_time: nowTime(), final_status: 'Correcte' } });
    } else {
      if (a.confirm && !confirm(a.confirm)) return;
      const { error, count } = await supabase.from(res.table).update(a.values(row), { count: 'exact' }).eq('id', row.id);
      if (error || count === 0) toast(error ? errorMessage(error) : 'No tens permís per fer-ho.');
      else { toast('Fet'); load(); }
    }
  }

  const editable = (row: Row) => !readOnly && canEdit(res, row, role, email);
  const open = (row: Row) => (res.card || !editable(row) ? setDetail(row) : setForm({ resource: res, row }));

  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">{`${shown.length} ${shown.length === 1 ? 'registre' : 'registres'}`}</span>
          <h1>{res.title}</h1>
          {res.hint && <p>{res.hint}</p>}
        </div>
        {!readOnly && canCreate(res, role) && (
          <button className="btn btn-primary" onClick={() => setForm({ resource: res })}><Plus />Nou</button>
        )}
      </header>

      <div className="toolbar">
        <label className="search"><Search /><input type="search" placeholder="Cerca" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        {res.filters && (
          <div className="segmented" role="tablist">
            <button className={filter == null ? 'on' : ''} onClick={() => setFilter(null)}>Tot</button>
            {res.filters.map((f, i) => (
              <button key={f.label} className={filter === i ? 'on' : ''} onClick={() => setFilter(i)}>{f.label}</button>
            ))}
          </div>
        )}
      </div>

      {cats.length > 1 && (
        <div className="cats">
          <button className={cat == null ? 'on' : ''} onClick={() => setCat(null)}>Totes les categories</button>
          {cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      )}

      <ErrorBox error={error} />
      {loading ? <Spinner /> : shown.length === 0 ? (
        <Empty icon={search || filter != null || cat ? SearchX : Icon}>
          {search || filter != null || cat ? 'Cap resultat amb aquest filtre' : `Encara no hi ha cap ${res.singular}`}
        </Empty>
      ) : res.card ? (
        <div className="grid">
          {shown.map((r) => {
            const st = res.card!.status(r);
            const acts = visibleActions(r).slice(0, 2);
            return (
              <article key={r.id} className={`card ${r.active === false ? 'inactive' : ''}`} onClick={() => open(r)}>
                <div className="card-photo">
                  <Photo path={r[res.card!.photo]} icon={Icon} alt={res.card!.title(r)} />
                  <Status tone={st.tone} className="status-chip">{st.label}</Status>
                </div>
                <div className="card-body">
                  <div className="card-title">{res.card!.title(r)}</div>
                  {res.card!.subtitle && <div className="card-sub">{res.card!.subtitle(r, label)}</div>}
                  {res.card!.meta && res.card!.meta(r, label) && <div className="card-meta">{res.card!.meta(r, label)}</div>}
                </div>
                {acts.length > 0 && (
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    {acts.map((a, i) => (
                      <button key={a.label} className={`btn btn-sm ${i === 0 ? 'btn-primary' : ''}`} onClick={() => runAction(a, r)}>{a.label}</button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {res.columns.map((c, i) => <th key={i} className={c.hideOnMobile ? 'hide-m' : ''}>{c.label}</th>)}
                  {res.actions && !readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => open(r)} className={r.active === false ? 'row-inactive' : ''}>
                    {res.columns.map((c, i) => (
                      <td key={i} className={c.hideOnMobile ? 'hide-m' : ''}>
                        {c.photo ? <Thumb path={r[c.photo]} /> : c.tone ? <Status tone={c.tone(r)}>{c.value(r, label)}</Status> : c.value(r, label)}
                      </td>
                    ))}
                    {res.actions && !readOnly && (
                      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                        {visibleActions(r).map((a) => (
                          <button key={a.label} className="btn btn-sm" onClick={() => runAction(a, r)}>{a.label}</button>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <RecordForm
          resource={form.resource} row={form.row} preset={form.preset} refs={refs}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); toast('Desat'); load(); reloadRefs(); }}
        />
      )}
      {detail && (
        <Detail
          res={res} row={detail} refs={refs} actions={visibleActions(detail)}
          onAction={(a) => runAction(a, detail)}
          onEdit={editable(detail) ? () => { setDetail(null); setForm({ resource: res, row: detail }); } : undefined}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

function show(f: Field, v: any, refs: RefOptions): string {
  if (v == null || v === '') return '—';
  switch (f.type) {
    case 'date': return fmtDate(v);
    case 'time': return fmtTime(v);
    case 'bool': return v ? 'Sí' : 'No';
    case 'file': return 'Document adjunt';
    case 'ref': return refs[f.name]?.find((o) => o.id === v)?.label ?? '—';
    default: return String(v);
  }
}

function Detail({ res, row, refs, actions, onAction, onEdit, onClose }: {
  res: Resource; row: Row; refs: RefOptions; actions: RowAction[];
  onAction: (a: RowAction) => void; onEdit?: () => void; onClose: () => void;
}) {
  const Icon = RESOURCE_ICON[res.key] ?? MODULE_ICON[res.module];
  const card = res.card;
  const title = card ? card.title(row) : res.singular[0].toUpperCase() + res.singular.slice(1);
  const st = card?.status(row);
  const fields = res.fields.filter((f) => f.type !== 'photo' && row[f.name] != null && row[f.name] !== '' && !(card && String(row[f.name]) === title));
  return (
    <Modal title={title} onClose={onClose} hero={card ? <Photo path={row[card.photo]} icon={Icon} alt={title} /> : undefined}>
      {card && <span className="label detail-kind">{res.singular}</span>}
      {card && <h2 className="detail-title">{title}</h2>}
      {st && <Status tone={st.tone}>{st.label}</Status>}
      {(actions.length > 0 || onEdit) && (
        <div className="detail-actions">
          {actions.map((a, i) => <button key={a.label} className={`btn ${i === 0 ? 'btn-primary' : ''}`} onClick={() => onAction(a)}>{a.label}</button>)}
          {onEdit && <button className="btn btn-ghost" onClick={onEdit}><Pencil />Edita</button>}
        </div>
      )}
      <dl className="detail">
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'field-wide' : ''}>
            <dt>{f.label}</dt>
            <dd>{f.type === 'url' ? <a href={row[f.name]} target="_blank" rel="noreferrer">Obre l'enllaç ↗</a> : show(f, row[f.name], refs)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
