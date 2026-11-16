import { useNavigate } from 'react-router-dom';
import { useSchool } from '../../lib/school';
import { supabase, errorMessage } from '../../lib/supabase';
import { RESOURCES } from '../../resources';
import { toast } from '../../components/ui';
import { MODULE_ICON } from '../../icons';

export default function Modules() {
  const { school, schools, modules, enabled, reload, role, selectSchool } = useSchool();
  const nav = useNavigate();
  if (role !== 'admin') return <p>Només l'administrador del centre pot activar o desactivar mòduls.</p>;
  const demo = schools.find((s) => s.is_demo);

  async function toggle(key: string, on: boolean) {
    const { error } = await supabase.from('school_modules')
      .upsert({ school_id: school!.id, module: key, enabled: on }, { onConflict: 'school_id,module' });
    if (error) toast(errorMessage(error)); else { toast(on ? 'Mòdul activat' : 'Mòdul desactivat'); reload(); }
  }

  function seeDemo(key: string) {
    if (!demo) return;
    const first = RESOURCES.find((r) => r.module === key);
    selectSchool(demo.id);
    nav(first ? `/r/${first.key}` : '/');
  }

  return (
    <section>
      <header className="page-head">
        <div><span className="eyebrow">Administració</span><h1>Mòduls</h1><p>Activa només el que el teu centre necessita. Desactivar un mòdul l'amaga, però no n'esborra les dades.</p></div>
      </header>
      <div className="module-grid">
        {modules.map((m) => {
          const on = enabled.has(m.key);
          return (
            <article key={m.key} className={`module ${on ? '' : 'off'}`}>
              <header>
                <div><span className="m-icon">{(() => { const I = MODULE_ICON[m.key]; return I ? <I /> : null; })()}</span><h3>{m.name}</h3></div>
                <label className="switch">
                  <input type="checkbox" checked={on} onChange={(e) => toggle(m.key, e.target.checked)} />
                  <span />
                </label>
              </header>
              <p>{m.description}</p>
              <small className="label">Pantalles: {RESOURCES.filter((r) => r.module === m.key).map((r) => r.title).join(', ')}</small>
              {demo && <button className="btn btn-sm btn-ghost" onClick={() => seeDemo(m.key)}>Veure-ho a la demo ↗</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
