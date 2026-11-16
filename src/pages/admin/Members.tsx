import { useState, type FormEvent } from 'react';
import { useSchool, type Member, type Role } from '../../lib/school';
import { supabase, errorMessage } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Pill, ErrorBox, Modal, toast } from '../../components/ui';

const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'docent', label: 'Docent', help: 'Registra usos, incidències, préstecs, consum, sessions i projectes' },
  { value: 'gestor', label: 'Gestor', help: 'Gestiona màquines, material, estoc, incidències i manteniment' },
  { value: 'admin', label: 'Admin', help: 'Tot l\'anterior + usuaris, mòduls i llistes' },
];

export default function Members() {
  const { school, members, reload, role } = useSchool();
  const { email: me } = useAuth();
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'docent' as Role });

  if (role !== 'admin') return <p>Només l'administrador del centre pot gestionar els usuaris.</p>;

  async function run(p: PromiseLike<{ error: unknown }>, ok: string) {
    setError(null);
    const { error } = await p;
    if (error) setError(errorMessage(error)); else { toast(ok); await reload(); }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    await run(supabase.from('school_members').insert({ ...form, email: form.email.trim().toLowerCase(), school_id: school!.id }), 'Usuari afegit');
    setForm({ email: '', full_name: '', role: 'docent' });
  }

  const update = (m: Member, v: Partial<Member>) => run(supabase.from('school_members').update(v).eq('id', m.id), 'Desat');
  const remove = (m: Member) => confirm(`Treure ${m.email} del centre?`) &&
    run(supabase.from('school_members').delete().eq('id', m.id), 'Usuari eliminat');

  return (
    <section>
      <header className="page-head">
        <div><span className="eyebrow">Administració</span><h1>Usuaris</h1><p>Les persones entren amb el seu compte de Google (o un enllaç al correu). Només cal afegir-ne el correu aquí.</p></div>
        <button className="btn" onClick={() => setBulk(true)}>Afegir molts de cop</button>
      </header>

      <form className="inline-form" onSubmit={add}>
        <input type="email" required placeholder="correu@escola.cat" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Nom (opcional)" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button className="btn btn-primary">Afegeix</button>
      </form>
      <ErrorBox error={error} />

      <div className="table-wrap"><div className="table-scroll">
        <table className="table">
          <thead><tr><th>Correu</th><th className="hide-m">Nom</th><th>Rol</th><th>Actiu</th><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={m.active ? '' : 'row-inactive'}>
                <td>{m.email} {m.email === me && <Pill tone="info">tu</Pill>}</td>
                <td className="hide-m">{m.full_name}</td>
                <td>
                  <select value={m.role} onChange={(e) => update(m, { role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" checked={m.active} onChange={(e) => update(m, { active: e.target.checked })} /></td>
                <td><button className="btn btn-sm btn-danger" onClick={() => remove(m)}>Treu</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      <ul className="muted small">{ROLES.map((r) => <li key={r.value}><b>{r.label}:</b> {r.help}</li>)}</ul>

      {bulk && <BulkAdd onClose={() => setBulk(false)} onDone={async () => { setBulk(false); await reload(); }} />}
    </section>
  );
}

function BulkAdd({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { school, members } = useSchool();
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role>('docent');
  const [error, setError] = useState<string | null>(null);
  const existing = new Set(members.map((m) => m.email));
  const emails = [...new Set((text.match(/[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/g) ?? []).map((e) => e.toLowerCase()))];
  const fresh = emails.filter((e) => !existing.has(e));

  async function save() {
    const { error } = await supabase.from('school_members').insert(fresh.map((email) => ({ email, role, school_id: school!.id })));
    if (error) setError(errorMessage(error)); else { toast(`${fresh.length} usuaris afegits`); onDone(); }
  }

  return (
    <Modal title="Afegir usuaris de cop" onClose={onClose}>
      <p className="muted">Enganxa-hi correus (un per línia, o separats per comes). Pots copiar directament la llista del claustre.</p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="field"><span className="field-label">Rol per a tots</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
      </label>
      <p>{emails.length} correus detectats · <b>{fresh.length} nous</b></p>
      <ErrorBox error={error} />
      <footer className="form-actions"><span className="spacer" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel·la</button>
        <button className="btn btn-primary" disabled={!fresh.length} onClick={save}>Afegeix {fresh.length}</button>
      </footer>
    </Modal>
  );
}
