import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Mail, Send } from 'lucide-react';
import { useSchool } from '../lib/school';
import { supabase, errorMessage } from '../lib/supabase';
import { ErrorBox, Pill, toast } from '../components/ui';
import { fmtDate } from '../lib/format';

const FEATURES = [
  ['Màquines', 'Qui fa servir cada impressora, làser o plòter i quan. L\'estat de la màquina canvia sol quan algú hi comença o hi acaba.'],
  ['Material', 'Els robots i kits que es presten: quants en queden, qui els té i quins préstecs van endarrerits.'],
  ['Estoc', 'Filament, fusta, vinil… L\'estoc es calcula sol amb cada entrada i consum i avisa quan cal reposar.'],
  ['Calendari', 'Les sessions de l\'aula, el manteniment i els retorns en un sol lloc. No deixa reservar l\'aula dues vegades a la mateixa hora.'],
  ['Incidències', 'Una avaria es comunica en un minut, amb foto des del mòbil, i la màquina queda marcada fins que s\'arregla.'],
  ['Privat', 'Cada escola només veu les seves dades. Es guarden a la Unió Europea i no es comparteixen amb ningú.'],
];

// L'adreça no és al codi en clar: així els robots que rastregen webs no la troben
const P = ['moc.liamg', 'piuqesmic'];
const reveal = () => `${P[1].split('').reverse().join('')}@${P[0].split('').reverse().join('')}`;

interface Mine { id: string; kind: string; message: string; status: string; created_at: string }

export default function About() {
  const { school, readOnly } = useSchool();
  const loc = useLocation();
  const fbRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [kind, setKind] = useState('Millora');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const openedAt = useRef(Date.now());

  const loadMine = () => supabase.from('feedback').select('id, kind, message, status, created_at').order('created_at', { ascending: false }).limit(10)
    .then(({ data }) => setMine((data as Mine[]) ?? []));
  useEffect(() => { loadMine(); }, []);
  useEffect(() => { if (loc.hash === '#suggeriments') setTimeout(() => fbRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }, [loc.hash]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (hp) return;                                                   // camp trampa: només l'omplen els robots
    if (Date.now() - openedAt.current < 3000) { setError('Espera un moment abans d\'enviar-ho.'); return; }
    if (message.trim().length < 10) { setError('Explica-ho una mica més (mínim 10 caràcters).'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.from('feedback').insert({
      kind, message: message.trim(), school_id: school?.id ?? null, page: navigator.userAgent.slice(0, 120),
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setMessage(''); toast('Gràcies! Ho llegirem aviat.'); loadMine();
  }

  const copy = async () => { try { await navigator.clipboard.writeText(email!); toast('Adreça copiada'); } catch { /* ignore */ } };

  return (
    <section className="narrow-col" style={{ maxWidth: 760 }}>
      <div className="about-hero">
        <h1>Saber què passa a l'aula, sense paperassa</h1>
        <p>
          FabAula és l'eina perquè tot el claustre pugui fer servir l'aula maker sense dependre d'una persona: reservar-la,
          saber quina màquina està lliure, prestar material i avisar quan alguna cosa s'espatlla. Funciona al mòbil i a l'ordinador,
          i és gratuïta per a les escoles.
        </p>
      </div>

      <div className="feature-rows">
        {FEATURES.map(([t, d]) => <div key={t} className="feature-row"><b>{t}</b><p>{d}</p></div>)}
      </div>

      <div className="block">
        <h2>Per què existeix</h2>
        <div className="panel author" style={{ marginTop: 14 }}>
          <span className="avatar">FA</span>
          <div className="stack" style={{ gap: 8 }}>
            <p><b>L'equip de FabAula</b></p>
            <p className="muted">
              FabAula va néixer d'un favor. Una mestra que coordina l'aula maker de la seva escola s'havia fet una app amb AppSheet
              per controlar les màquines i el material, però la versió gratuïta només la podien fer servir deu persones, i el claustre
              en té trenta. En lloc de pagar llicències, la vam refer de zero: oberta a tot el claustre, pensada per fer-la servir des del
              mòbil a l'aula i preparada perquè qualsevol altra escola la pugui adaptar a la seva manera.
            </p>
          </div>
        </div>
      </div>

      <div className="block" ref={fbRef} id="suggeriments">
        <h2>Ajuda'ns a millorar-la</h2>
        <p className="muted" style={{ marginTop: 6 }}>Si alguna cosa no funciona, et molesta o trobes a faltar res, explica-ho. Ho llegeix una persona.</p>
        <div className="two" style={{ marginTop: 16 }}>
          <form className="panel" onSubmit={send}>
            <h3>Envia un suggeriment</h3>
            {readOnly && school?.is_demo && <p className="small">També des de la demo.</p>}
            <div className="segmented" role="radiogroup" aria-label="Tipus">
              {['Millora', 'Error', 'Queixa', 'Altres'].map((k) => (
                <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k}</button>
              ))}
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000}
                      placeholder={kind === 'Error' ? 'Què has fet, què esperaves i què ha passat?' : 'Explica-ho amb dues o tres frases'} />
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
            <ErrorBox error={error} />
            <div className="row">
              <button className="btn btn-blue" disabled={busy || message.trim().length < 10}><Send />{busy ? 'Enviant…' : 'Envia'}</button>
              <span className="muted small">{message.length}/2000</span>
            </div>
            <p className="small muted">S'envia amb el teu nom d'usuari. Màxim 5 missatges al dia.</p>
          </form>

          <div className="panel">
            <h3>Prefereixes el correu?</h3>
            <p>Escriu dues línies explicant què ha passat i on. Contestem tan aviat com podem.</p>
            {email ? (
              <div className="stack">
                <span className="revealed">{email}</span>
                <div className="row">
                  <a className="btn btn-blue" href={`mailto:${email}?subject=${encodeURIComponent('FabAula: suggeriment')}`}><Mail />Escriu un correu</a>
                  <button className="btn" onClick={copy}><Copy />Copia</button>
                </div>
              </div>
            ) : (
              <div><button className="btn btn-blue" onClick={() => setEmail(reveal())}><Mail />Mostra el correu</button></div>
            )}
            <p className="small muted">Mai et demanarem contrasenyes ni dades personals per correu. Ignora qualsevol missatge que ho faci.</p>
          </div>
        </div>

        {mine.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 10 }}>Els teus missatges</h3>
            <div className="alerts">
              {mine.map((m) => (
                <div key={m.id} className="alert" style={{ alignItems: 'flex-start' }}>
                  <Pill tone={m.status === 'Fet' ? 'ok' : m.status === 'Descartat' ? 'muted' : m.status === 'Llegit' ? 'info' : 'warn'}>{m.status}</Pill>
                  <span style={{ flex: 1 }}><b>{m.kind}</b> · {m.message}</span>
                  <span className="muted small">{fmtDate(m.created_at.slice(0, 10))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="footnote">FabAula no és una eina oficial del Departament d'Educació. Cada centre és responsable de les dades que hi introdueix. <a href="./privacitat.html">Política de privacitat</a></p>
    </section>
  );
}
