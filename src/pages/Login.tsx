import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { configured, errorMessage } from '../lib/supabase';
import { ErrorBox } from '../components/ui';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1a6.4 6.4 0 0 1-6-4.4H2.3v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8L6 14.3z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1a6.4 6.4 0 0 1 6-4.7z" />
    </svg>
  );
}

export default function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    try { await signInWithGoogle(); } catch (e) { setError(errorMessage(e)); }
  }
  async function magic(e: FormEvent) {
    e.preventDefault();
    try { await signInWithEmail(email.trim()); setSent(true); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <main className="login">
      <div className="login-card">
        <img className="login-mark" src="./icon.svg" alt="" />
        <div>
          <span className="eyebrow">Gestió d'aules maker</span>
          <h1>FabAula</h1>
          <p className="muted">Màquines, material, consumibles i incidències de l'aula, en un sol lloc.</p>
        </div>
        {!configured && <ErrorBox error="Falta configurar VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY (mira docs/SETUP.md)." />}
        <button className="btn btn-lg btn-block" onClick={google}><GoogleIcon />Entra amb Google</button>
        <div className="or">o bé</div>
        {sent ? (
          <p className="notice">T'hem enviat un enllaç a <b>{email}</b>. Obre'l des d'aquest mateix navegador.</p>
        ) : (
          <form onSubmit={magic} className="stack">
            <input type="email" required placeholder="el-teu-correu@escola.cat" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary btn-lg btn-block" type="submit">Envia'm un enllaç d'accés<ArrowRight /></button>
          </form>
        )}
        <ErrorBox error={error} />
        <p className="muted small">Només hi tens accés si l'administrador del teu centre ha afegit el teu correu. · <a href="./privacitat.html">Privacitat</a></p>
      </div>
    </main>
  );
}
