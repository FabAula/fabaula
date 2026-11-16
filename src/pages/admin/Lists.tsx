import { useEffect, useState, type FormEvent } from 'react';
import { useSchool } from '../../lib/school';
import { supabase, errorMessage } from '../../lib/supabase';
import { ErrorBox, toast } from '../../components/ui';

interface Def { key: string; name: string; description: string | null }
interface Item { id: string; value: string; sort: number; active: boolean }

export default function Lists() {
  const { school, role, reload } = useSchool();
  const [defs, setDefs] = useState<Def[]>([]);
  const [current, setCurrent] = useState('grups');
  const [items, setItems] = useState<Item[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { supabase.from('list_defs').select('*').order('sort').then(({ data }) => setDefs(data ?? [])); }, []);
  const load = async () => {
    const { data } = await supabase.from('list_items').select('id, value, sort, active')
      .eq('school_id', school!.id).eq('list_key', current).order('sort');
    setItems(data ?? []);
  };
  useEffect(() => { if (school) load(); }, [current, school?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (role !== 'admin') return <p>Només l'administrador del centre pot editar les llistes.</p>;

  async function run(p: PromiseLike<{ error: unknown }>) {
    setError(null);
    const { error } = await p;
    if (error) setError(errorMessage(error)); else { await load(); reload(); }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const sort = Math.max(0, ...items.map((i) => i.sort)) + 1;
    await run(supabase.from('list_items').insert({ school_id: school!.id, list_key: current, value: value.trim(), sort }));
    setValue(''); toast('Afegit');
  }

  async function move(i: number, dir: -1 | 1) {
    const a = items[i], b = items[i + dir];
    if (!a || !b) return;
    await run(supabase.from('list_items').upsert([{ ...a, sort: b.sort, school_id: school!.id, list_key: current }, { ...b, sort: a.sort, school_id: school!.id, list_key: current }]));
  }

  const def = defs.find((d) => d.key === current);
  return (
    <section>
      <header className="page-head"><div><span className="eyebrow">Administració</span><h1>Llistes</h1><p>Les opcions dels desplegables, adaptades al teu centre.</p></div></header>
      <div className="lists-layout">
        <nav className="lists-nav">
          {defs.map((d) => <button key={d.key} className={d.key === current ? 'on' : ''} onClick={() => setCurrent(d.key)}>{d.name}</button>)}
        </nav>
        <div>
          <h2>{def?.name}</h2>
          {def?.description && <p className="muted">{def.description}</p>}
          <form className="inline-form" onSubmit={add}>
            <input required placeholder="Nova opció" value={value} onChange={(e) => setValue(e.target.value)} />
            <button className="btn btn-primary">Afegeix</button>
          </form>
          <ErrorBox error={error} />
          <ul className="list-items">
            {items.map((it, i) => (
              <li key={it.id} className={it.active ? '' : 'row-inactive'}>
                <span>{it.value}</span>
                <span className="spacer" />
                <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Puja">↑</button>
                <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Baixa">↓</button>
                <label className="small"><input type="checkbox" checked={it.active} onChange={(e) => run(supabase.from('list_items').update({ active: e.target.checked }).eq('id', it.id))} /> visible</label>
                <button className="btn btn-sm btn-danger" onClick={() => run(supabase.from('list_items').delete().eq('id', it.id))}>Esborra</button>
              </li>
            ))}
          </ul>
          <p className="muted small">Esborrar una opció no canvia els registres que ja la fan servir.</p>
        </div>
      </div>
    </section>
  );
}
