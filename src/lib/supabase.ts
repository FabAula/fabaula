import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    // PKCE: el codi torna a ?code=..., així no xoca amb el HashRouter (#/ruta)
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
});

/** Converteix errors de Postgres/Supabase en missatges llegibles */
export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/row-level security/i.test(msg)) return 'No tens permís per fer aquesta acció.';
  if (/duplicate key/i.test(msg)) return 'Ja existeix un registre amb aquestes dades.';
  if (/foreign key/i.test(msg)) return 'Aquest registre està en ús en altres llocs i no es pot esborrar.';
  return msg;
}
