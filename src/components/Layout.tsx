import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Repeat, X, type LucideIcon } from 'lucide-react';
import { useSchool } from '../lib/school';
import { useAuth } from '../lib/auth';
import { useMediaUrl } from '../lib/media';
import { useTheme } from '../lib/theme';
import { RESOURCES } from '../resources';
import { MODULE_ICON, NAV_ICON, RESOURCE_ICON } from '../icons';

export const ROLE_LABEL = { admin: 'Administració', gestor: 'Gestió', docent: 'Docent' } as const;

export function initials(s: string) {
  return s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

export function BrandMark({ size }: { size?: number }) {
  const { school } = useSchool();
  const url = useMediaUrl(school?.logo_path);
  const style = size ? { width: size, height: size, fontSize: size * 0.45, borderRadius: size * 0.26 } : undefined;
  return url
    ? <img className="brand-logo" src={url} alt="" style={{ ...style, background: '#fff' }} />
    : <span className="brand-logo" style={style}>{(school?.name ?? 'F').replace(/^(Escola|Institut|Col·legi|Centre)\s+(de\s+|del\s+|d')?/i, '')[0]}</span>;
}

interface Item { to: string; label: string; icon: LucideIcon }
interface Section { title: string; items: Item[] }

/** Tot el mapa de navegació, agrupat com un campus: mòduls, administració i FabAula */
function useSections(): Section[] {
  const { modules, enabled, role, school, isPlatformAdmin } = useSchool();
  const out: Section[] = [];
  const general: Item[] = [{ to: '/', label: 'Inici', icon: NAV_ICON.home }];
  if (['espais', 'manteniment', 'prestecs'].some((m) => enabled.has(m))) general.push({ to: '/calendari', label: 'Calendari', icon: NAV_ICON.calendar });
  out.push({ title: 'General', items: general });
  for (const m of modules.filter((x) => enabled.has(x.key))) {
    out.push({
      title: m.name,
      items: RESOURCES.filter((r) => r.module === m.key).map((r) => ({ to: `/r/${r.key}`, label: r.title, icon: RESOURCE_ICON[r.key] ?? MODULE_ICON[m.key] })),
    });
  }
  if (role === 'admin' && !school?.is_demo) {
    out.push({ title: 'Administració', items: [
      { to: '/admin/usuaris', label: 'Usuaris', icon: NAV_ICON.users },
      { to: '/admin/moduls', label: 'Mòduls', icon: NAV_ICON.modules },
      { to: '/admin/llistes', label: 'Llistes', icon: NAV_ICON.lists },
      { to: '/admin/centre', label: 'Identitat del centre', icon: NAV_ICON.brand },
      { to: '/admin/fotos', label: 'Importar fotos', icon: NAV_ICON.photos },
    ] });
  }
  const fab: Item[] = [
    { to: '/sobre', label: 'Sobre FabAula', icon: NAV_ICON.about },
    { to: '/sobre#suggeriments', label: 'Suggeriments', icon: NAV_ICON.feedback },
  ];
  if (isPlatformAdmin) fab.push({ to: '/plataforma', label: 'Plataforma', icon: NAV_ICON.platform });
  out.push({ title: 'FabAula', items: fab });
  return out;
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const Icon = theme === 'dark' ? NAV_ICON.sun : NAV_ICON.moon;
  return <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Mode clar' : 'Mode fosc'} title={theme === 'dark' ? 'Mode clar' : 'Mode fosc'}><Icon /></button>;
}

function Avatar({ lg }: { lg?: boolean }) {
  const { me } = useSchool();
  const { email } = useAuth();
  return <span className={`avatar ${lg ? 'lg' : ''}`}>{initials(me?.full_name || email)}</span>;
}

function SchoolSwitch({ after }: { after?: () => void }) {
  const { schools, school, selectSchool } = useSchool();
  if (schools.length < 2) return null;
  return (
    <select value={school?.id ?? ''} onChange={(e) => { selectSchool(e.target.value); after?.(); }} aria-label="Centre">
      {schools.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_demo ? ' (demo)' : ''}</option>)}
    </select>
  );
}

function Dropdown({ className, onClose, children }: { className: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (<><div className="dd-scrim" onClick={onClose} /><div className={`dropdown ${className}`}>{children}</div></>);
}

export default function Layout() {
  const { school, enabled, me, role, selectSchool } = useSchool();
  const { email, signOut } = useAuth();
  const sections = useSections();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState<'mega' | 'user' | 'mobile' | null>(null);
  useEffect(() => { setOpen(null); window.scrollTo(0, 0); }, [loc.pathname]);

  // Pestanyes principals de la barra superior (les que més es fan servir a l'aula)
  const main: (Item & { module?: string; extra?: boolean })[] = ([
    { to: '/calendari', label: 'Calendari', icon: NAV_ICON.calendar, module: 'espais' },
    { to: '/r/maquines', label: 'Màquines', icon: RESOURCE_ICON.maquines, module: 'maquines' },
    { to: '/r/material', label: 'Material', icon: RESOURCE_ICON.material, module: 'prestecs' },
    { to: '/r/consumibles', label: 'Estoc', icon: RESOURCE_ICON.consumibles, module: 'consumibles', extra: true },
    { to: '/r/incidencies', label: 'Incidències', icon: RESOURCE_ICON.incidencies, module: 'incidencies', extra: true },
  ] as (Item & { module?: string; extra?: boolean })[]).filter((t) => !t.module || enabled.has(t.module));
  const mainPaths = new Set(['/', ...main.map((t) => t.to)]);
  const inMore = !mainPaths.has(loc.pathname);
  const mobileTabs = main.slice(0, 3);
  const name = me?.full_name || email;

  return (
    <div className="shell">
      <header className="topnav">
        <div className="topnav-in">
          <NavLink to="/" className="brand"><BrandMark /><span className="brand-name">{school?.name}</span></NavLink>
          <nav className="tabs" aria-label="Seccions">
            <NavLink to="/" end className="tab">Inici</NavLink>
            {main.map((t) => <NavLink key={t.to} to={t.to} className={`tab ${t.extra ? 'tab-x' : ''}`}>{t.label}</NavLink>)}
            <button className={`tab ${inMore ? 'active' : ''}`} onClick={() => setOpen(open === 'mega' ? null : 'mega')} aria-expanded={open === 'mega'}>
              Més <ChevronDown />
            </button>
          </nav>
          <div className="nav-tools">
            <ThemeButton />
            <button className="avatar-btn" onClick={() => setOpen(open === 'user' ? null : 'user')} aria-label="El meu compte"><Avatar /></button>
          </div>
        </div>
      </header>

      {open === 'mega' && (
        <Dropdown className="mega" onClose={() => setOpen(null)}>
          {sections.map((s) => (
            <div key={s.title}>
              <h4>{s.title}</h4>
              {s.items.map((i) => (
                <NavLink key={i.to} to={i.to} end className="menu-item" onClick={() => setOpen(null)}><i.icon />{i.label}</NavLink>
              ))}
            </div>
          ))}
        </Dropdown>
      )}

      {open === 'user' && (
        <Dropdown className="usermenu" onClose={() => setOpen(null)}>
          <div className="who">
            <Avatar lg />
            <div style={{ minWidth: 0 }}><b>{name}</b><span>{role ? ROLE_LABEL[role] : 'Només lectura'} · {school?.name}</span></div>
          </div>
          <SchoolSwitch after={() => setOpen(null)} />
          <button className="menu-item" onClick={() => nav('/sobre')}><NAV_ICON.about />Sobre FabAula</button>
          <button className="menu-item" onClick={() => nav('/sobre#suggeriments')}><NAV_ICON.feedback />Envia un suggeriment</button>
          <button className="menu-item" onClick={() => selectSchool(null)}><Repeat />Canvia de centre</button>
          <button className="menu-item" onClick={signOut}><LogOut />Tanca la sessió</button>
        </Dropdown>
      )}

      <main className="page"><Outlet /></main>

      {open === 'mobile' && (
        <div className="mobile-menu" role="dialog" aria-label="Menú">
          <div className="mm-me">
            <Avatar lg />
            <div style={{ minWidth: 0, flex: 1 }}><b>{name}</b><span>{role ? ROLE_LABEL[role] : 'Només lectura'} · {school?.name}</span></div>
            <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Tanca"><X /></button>
          </div>
          {sections.map((s) => (
            <div key={s.title}>
              <h4>{s.title}</h4>
              <div className="mm-tiles">
                {s.items.map((i) => (
                  <NavLink key={i.to} to={i.to} end className="mm-tile" onClick={() => setOpen(null)}><i.icon />{i.label}</NavLink>
                ))}
              </div>
            </div>
          ))}
          <h4>Compte</h4>
          <div className="stack">
            <SchoolSwitch after={() => setOpen(null)} />
            <div className="row">
              <button className="btn" onClick={() => selectSchool(null)}><Repeat />Canvia de centre</button>
              <button className="btn" onClick={signOut}><LogOut />Surt</button>
            </div>
          </div>
        </div>
      )}

      <nav className="tabbar" aria-label="Navegació principal">
        <NavLink to="/" end onClick={() => setOpen(null)}><NAV_ICON.home />Inici</NavLink>
        {mobileTabs.map((t) => <NavLink key={t.to} to={t.to} onClick={() => setOpen(null)}><t.icon />{t.label}</NavLink>)}
        <button className={open === 'mobile' || (loc.pathname !== '/' && !mobileTabs.some((t) => t.to === loc.pathname)) ? 'active' : ''} onClick={() => setOpen(open === 'mobile' ? null : 'mobile')}>
          <NAV_ICON.modules />Més
        </button>
      </nav>
    </div>
  );
}
