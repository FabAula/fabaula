import { Link } from 'react-router-dom';
import { ChevronRight, Eye, LogOut, Shield } from 'lucide-react';
import { useSchool, type School } from '../lib/school';
import { useAuth } from '../lib/auth';
import { useMediaUrl } from '../lib/media';

const ROLE = { admin: 'Admin', gestor: 'Gestor', docent: 'Docent' } as const;

function SchoolRow({ s, onPick }: { s: School; onPick: () => void }) {
  const url = useMediaUrl(s.logo_path);
  return (
    <button className="pick" onClick={onPick}>
      {url ? <img className="brand-logo" src={url} alt="" style={{ background: '#fff' }} />
        : <span className="brand-logo" style={{ background: s.brand_color ?? '#0c0c0b', color: '#fff' }}>{s.name.replace(/^(Escola|Institut)\s+(de\s+|del\s+|d')?/i, '')[0]}</span>}
      <div style={{ flex: 1 }}><b>{s.name}</b><span>{s.is_demo ? 'Demostració · lectura' : s.role ? ROLE[s.role] : 'Plataforma'}</span></div>
      {s.is_demo ? <Eye size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

export default function SchoolPicker() {
  const { schools, selectSchool, isPlatformAdmin } = useSchool();
  const { email, signOut } = useAuth();
  const own = schools.filter((s) => !s.is_demo && (s.role || isPlatformAdmin));
  const demos = schools.filter((s) => s.is_demo);
  return (
    <main className="login">
      <div className="login-card wide">
        <div>
          <span className="eyebrow">{email}</span>
          <h1>Hola!</h1>
        </div>
        {own.length > 0 ? (
          <ul className="pick-list">{own.map((s) => <li key={s.id}><SchoolRow s={s} onPick={() => selectSchool(s.id)} /></li>)}</ul>
        ) : isPlatformAdmin ? (
          <p className="notice">Encara no hi ha cap centre. Crea'n un des de l'administració de la plataforma.</p>
        ) : (
          <p className="notice">Encara no formes part de cap centre. Demana a l'administrador del teu centre que t'afegeixi amb aquest correu.</p>
        )}
        {demos.length > 0 && (
          <>
            <div className="or">prova-ho</div>
            <ul className="pick-list">{demos.map((s) => <li key={s.id}><SchoolRow s={s} onPick={() => selectSchool(s.id)} /></li>)}</ul>
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          {isPlatformAdmin && <Link className="btn btn-primary" to="/plataforma"><Shield />Plataforma</Link>}
          <button className="btn btn-ghost" onClick={signOut}><LogOut />Surt</button>
        </div>
      </div>
    </main>
  );
}
