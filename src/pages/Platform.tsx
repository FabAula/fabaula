import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../lib/school';
import { supabase, errorMessage } from '../lib/supabase';
import { ErrorBox, Pill, toast } from '../components/ui';
import { fmtDate } from '../lib/format';

interface Feedback { id: string; email: string; kind: string; message: string; status: string; created_at: string; school_id: string | null }

interface Admin { school_id: string; email: string; role: string; active: boolean }

export default function Platform() {
  const { isPlatformAdmin, schools, reload } = useSchool();
  const [form, setForm] = useState({ name: '', slug: '', email: '', admin_name: '' });
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const loadFeedback = () => supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(100)
    .then(({ data }) => setFeedback((data as Feedback[]) ?? []));
  useEffect(() => { if (isPlatformAdmin) loadFeedback(); }, [isPlatformAdmin]);
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) toast(errorMessage(error)); else loadFeedback();
  }

  const loadAdmins = () => supabase.from('school_members').select('school_id, email, role, active').eq('role', 'admin')
    .then(({ data }) => setAdmins(data ?? []));
  useEffect(() => { if (isPlatformAdmin) loadAdmins(); }, [isPlatformAdmin, schools.length]);

  if (!isPlatformAdmin) return <p>No tens accés a aquesta pàgina.</p>;

  async function create(e: FormEvent) {
    e.preventDefault(); setError(null);
    const { error } = await supabase.rpc('create_school', {
      p_name: form.name, p_slug: form.slug, p_admin_email: form.email, p_admin_name: form.admin_name || null,
    });
    if (error) return setError(errorMessage(error));
    toast('Centre creat'); setForm({ name: '', slug: '', email: '', admin_name: '' }); reload();
  }

  async function addAdmin(schoolId: string) {
    const email = prompt('Correu del nou administrador:')?.trim().toLowerCase();
    if (!email) return;
    const { error } = await supabase.from('school_members').upsert({ school_id: schoolId, email, role: 'admin', active: true }, { onConflict: 'school_id,email' });
    if (error) toast(errorMessage(error)); else { toast('Admin afegit'); loadAdmins(); }
  }

  async function resetDemo() {
    if (!confirm('Esborrar i tornar a crear l\'escola de demostració?')) return;
    const { error } = await supabase.rpc('reset_demo');
    if (error) toast(errorMessage(error)); else { toast('Demo reiniciada'); reload(); }
  }

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <section>
      <header className="page-head">
        <div><span className="eyebrow">FabAula</span><h1>Plataforma</h1><p>Alta de centres. Com a admin de plataforma no veus les dades dels centres, només en gestiones els administradors.</p></div>
        <Link className="btn" to="/">← Torna</Link>
      </header>

      <h2 style={{ margin: '8px 0 12px' }}>Nou centre</h2>
      <form className="form panel" onSubmit={create}>
        <label className="field"><span className="field-label">Nom del centre *</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} /></label>
        <label className="field"><span className="field-label">Identificador *</span>
          <input required pattern="[a-z0-9\-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
        <label className="field"><span className="field-label">Correu de l'administrador/a *</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field"><span className="field-label">Nom de l'administrador/a</span>
          <input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} /></label>
        <ErrorBox error={error} />
        <footer className="form-actions"><span className="spacer" /><button className="btn btn-primary">Crea el centre</button></footer>
      </form>

      <h2 style={{ margin: '36px 0 12px' }}>Centres</h2>
      <div className="table-wrap"><div className="table-scroll">
        <table className="table">
          <thead><tr><th>Centre</th><th>Administradors</th><th /></tr></thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id}>
                <td>{s.name} {s.is_demo && <small className="muted">(demo)</small>}</td>
                <td>{admins.filter((a) => a.school_id === s.id).map((a) => a.email).join(', ')}</td>
                <td>{s.is_demo ? <button className="btn btn-sm" onClick={resetDemo}>Reinicia</button>
                  : <button className="btn btn-sm" onClick={() => addAdmin(s.id)}>+ Admin</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>

      <h2 style={{ margin: '36px 0 12px' }}>Suggeriments {feedback.filter((f) => f.status === 'Nou').length > 0 && <Pill tone="warn">{feedback.filter((f) => f.status === 'Nou').length} nous</Pill>}</h2>
      {feedback.length === 0 ? <p className="muted">Encara no n'ha arribat cap.</p> : (
        <div className="table-wrap"><div className="table-scroll">
          <table className="table">
            <thead><tr><th>Data</th><th>Tipus</th><th>Missatge</th><th className="hide-m">De</th><th>Estat</th></tr></thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id} style={{ cursor: 'default' }}>
                  <td>{fmtDate(f.created_at.slice(0, 10))}</td>
                  <td>{f.kind}</td>
                  <td style={{ whiteSpace: 'pre-wrap', minWidth: 240 }}>{f.message}</td>
                  <td className="hide-m">{f.email}<br /><span className="muted small">{schools.find((s) => s.id === f.school_id)?.name ?? ''}</span></td>
                  <td>
                    <select value={f.status} onChange={(e) => setStatus(f.id, e.target.value)} style={{ width: 'auto' }}>
                      {['Nou', 'Llegit', 'Fet', 'Descartat'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </section>
  );
}
