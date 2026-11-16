import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeftRight, ArrowUpRight, Bot, CalendarClock, ChevronLeft, ChevronRight, Package, Printer, Wrench,
} from 'lucide-react';
import { useSchool } from '../lib/school';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fmtTime, nowTime, today } from '../lib/format';
import { Photo, Spinner } from '../components/ui';
import type { Row } from '../resources';

// ---------------------------------------------------------------- dates
const iso = (d: Date) => d.toLocaleDateString('sv-SE');
const parse = (s: string) => new Date(s + 'T00:00:00');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const daysUntil = (s: string) => Math.round((parse(s).getTime() - parse(today()).getTime()) / 86400000);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DOW = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Bona nit' : h < 14 ? 'Bon dia' : h < 20 ? 'Bona tarda' : 'Bon vespre';
}

// ---------------------------------------------------------------- model
type Kind = 'session' | 'maintenance' | 'loan';
interface Item { id: string; kind: Kind; date: string; start?: string; end?: string; title: string; sub: string; to: string; mine: boolean }
const COLOR: Record<Kind, string> = { session: 'var(--accent)', maintenance: 'var(--warn)', loan: 'var(--info)' };

function Ring({ days, color, big }: { days: number; color: string; big?: boolean }) {
  const size = big ? 104 : 52;
  const stroke = big ? 9 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = days <= 0 ? 1 : Math.max(0.08, 1 - days / 14);
  return (
    <div className={`ring ${big ? 'big' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="ring-in">
        {days <= 0 ? <b style={{ fontSize: big ? 22 : 13 }}>{days < 0 ? 'Tard' : 'Avui'}</b>
          : <div><b>{days}</b><br /><span>{days === 1 ? 'dia' : 'dies'}</span></div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { school, enabled, readOnly, me, members } = useSchool();
  const { email } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Row[]>([]);
  const [uses, setUses] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<{ tone: 'bad' | 'warn' | 'info'; text: string; to: string; icon: typeof Wrench }[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<'month' | 'week'>(() => (window.matchMedia('(max-width: 860px)').matches ? 'week' : 'month'));
  const [selected, setSelected] = useState(today());

  const nameOf = (mail?: string | null) => (mail ? members.find((m) => m.email === mail)?.full_name?.split(' ')[0] ?? mail.split('@')[0] : '');
  const first = me?.full_name?.split(' ')[0] ?? cap(email.split('@')[0] ?? '');

  // Dies visibles al calendari
  const days = useMemo(() => {
    if (view === 'week') { const s = startOfWeek(parse(selected)); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    const s = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const n = Math.ceil(((e.getTime() - s.getTime()) / 86400000 + 1) / 7) * 7;
    return Array.from({ length: n }, (_, i) => addDays(s, i));
  }, [cursor, view, selected]);

  useEffect(() => {
    if (!school) return;
    const sid = school.id;
    const t = today();
    const from = iso(days[0]) < t ? iso(days[0]) : t;
    const to = iso(addDays(days[days.length - 1], 1)) > iso(addDays(new Date(), 60)) ? iso(addDays(days[days.length - 1], 1)) : iso(addDays(new Date(), 60));

    (async () => {
      const q = <T,>(p: PromiseLike<{ data: T | null }>) => Promise.resolve(p).then((r) => r.data ?? ([] as unknown as T));
      const [st, ss, mt, ln, mq, us, sp, mat, inc, low] = await Promise.all([
        supabase.rpc('dashboard', { p_school: sid }).then((r) => r.data as Record<string, number>),
        enabled.has('espais') ? q<Row[]>(supabase.from('sessions').select('*').eq('school_id', sid).gte('session_date', from).lt('session_date', to).neq('status', 'Cancel·lada')) : [],
        enabled.has('manteniment') ? q<Row[]>(supabase.from('maintenance').select('id, task, planned_on, machine_id, status').eq('school_id', sid).in('status', ['Pendent', 'Programat', 'En curs'])) : [],
        enabled.has('prestecs') ? q<Row[]>(supabase.from('loans').select('id, material_id, qty, due_date, borrower_email').eq('school_id', sid).eq('status', 'Prestat')) : [],
        enabled.has('maquines') || enabled.has('manteniment') ? q<Row[]>(supabase.from('machines').select('id, name, photo_path, status').eq('school_id', sid)) : [],
        enabled.has('maquines') ? q<Row[]>(supabase.from('machine_uses').select('id, machine_id, user_email, start_time, planned_end_time').eq('school_id', sid).is('end_time', null)) : [],
        enabled.has('espais') ? q<Row[]>(supabase.from('spaces').select('id, name').eq('school_id', sid)) : [],
        enabled.has('prestecs') ? q<Row[]>(supabase.from('materials_availability').select('id, name, available_qty, status, active').eq('school_id', sid)) : [],
        enabled.has('incidencies') ? q<Row[]>(supabase.from('incidents').select('id, description, priority, machine_id').eq('school_id', sid).not('status', 'in', '("Resolta","No procedeix")')) : [],
        enabled.has('consumibles') ? q<Row[]>(supabase.from('consumables_stock').select('id, full_name, stock_status, active').eq('school_id', sid).neq('stock_status', 'Correcte')) : [],
      ]);
      setStats(st ?? {});
      const mName = new Map(mq.map((m) => [m.id, m.name]));
      const spName = new Map(sp.map((m) => [m.id, m.name]));
      const matName = new Map(mat.map((m) => [m.id, m.name]));
      setMachines(mq);
      setUses(us);

      const list = ([
        ...ss.map((s) => ({
          id: 's' + s.id, kind: 'session' as Kind, date: s.session_date, start: fmtTime(s.start_time), end: fmtTime(s.end_time),
          title: s.activity || s.group_name || 'Sessió',
          sub: [s.group_name, spName.get(s.space_id), nameOf(s.teacher_email)].filter(Boolean).join(' · '),
          to: '/calendari', mine: s.teacher_email === email,
        })),
        ...mt.filter((m) => m.planned_on).map((m) => ({
          id: 'm' + m.id, kind: 'maintenance' as Kind, date: m.planned_on, title: m.task, sub: `Manteniment · ${mName.get(m.machine_id) ?? ''}`,
          to: '/r/manteniment', mine: false,
        })),
        ...ln.filter((l) => l.due_date).map((l) => ({
          id: 'l' + l.id, kind: 'loan' as Kind, date: l.due_date, title: `Retorn: ${matName.get(l.material_id) ?? 'material'}${l.qty > 1 ? ` ×${l.qty}` : ''}`,
          sub: `Préstec · ${nameOf(l.borrower_email)}`, to: '/r/prestecs', mine: l.borrower_email === email,
        })),
      ] as Item[]).sort((a, b) => (a.date + (a.start ?? "00:00")).localeCompare(b.date + (b.start ?? "00:00")));
      setItems(list);

      const a: typeof alerts = [];
      const urgent = inc.filter((i) => ['Alta', 'Urgent'].includes(i.priority));
      if (urgent.length) a.push({ tone: 'bad', icon: AlertTriangle, to: '/r/incidencies', text: `${urgent.length} ${urgent.length === 1 ? 'incidència urgent' : 'incidències urgents'}: ${urgent.slice(0, 2).map((i) => mName.get(i.machine_id) ?? i.description).join(', ')}` });
      const lateMine = ln.filter((l) => l.due_date && l.due_date < t && l.borrower_email === email);
      const late = ln.filter((l) => l.due_date && l.due_date < t);
      if (lateMine.length) a.push({ tone: 'bad', icon: ArrowLeftRight, to: '/r/prestecs', text: `Tens ${lateMine.length === 1 ? 'un préstec' : `${lateMine.length} préstecs`} per retornar que ja ha passat de data` });
      else if (late.length) a.push({ tone: 'warn', icon: ArrowLeftRight, to: '/r/prestecs', text: `${late.length} ${late.length === 1 ? 'préstec endarrerit' : 'préstecs endarrerits'}` });
      const lateMaint = mt.filter((m) => m.planned_on && m.planned_on < t);
      if (lateMaint.length) a.push({ tone: 'warn', icon: Wrench, to: '/r/manteniment', text: `${lateMaint.length} ${lateMaint.length === 1 ? 'tasca de manteniment endarrerida' : 'tasques de manteniment endarrerides'}` });
      const lowActive = low.filter((c) => c.active);
      if (lowActive.length) a.push({ tone: 'warn', icon: Package, to: '/r/consumibles', text: `Cal reposar: ${lowActive.slice(0, 3).map((c) => c.full_name).join(', ')}${lowActive.length > 3 ? '…' : ''}` });
      const down = mq.filter((m) => ['Avaria', 'Fora de servei'].includes(m.status));
      if (down.length) a.push({ tone: 'bad', icon: Printer, to: '/r/maquines', text: `${down.map((m) => m.name).join(', ')} ${down.length === 1 ? 'no es pot fer servir' : 'no es poden fer servir'}` });
      setAlerts(a);

      const avail = mat.filter((m) => m.active !== false && m.status === 'Disponible' && m.available_qty > 0).length;
      setCounts({
        maquines: `${mq.length} · ${us.length ? `${us.length} en ús` : 'cap en ús'}`,
        material: `${avail} de ${mat.length} disponibles`,
        consumibles: lowActive.length ? `${lowActive.length} per reposar` : 'Estoc correcte',
        incidencies: inc.length ? `${inc.length} obertes` : 'Cap oberta',
        manteniment: mt.length ? `${mt.length} pendents` : 'Al dia',
        calendari: `${ss.filter((s) => s.session_date === t).length} sessions avui`,
      });
    })();
  }, [school?.id, enabled, days[0]?.getTime(), days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats) return <Spinner />;

  const t = today();
  const now = nowTime();
  const byDay = new Map<string, Item[]>();
  for (const i of items) (byDay.get(i.date) ?? byDay.set(i.date, []).get(i.date)!).push(i);
  const upcoming = items.filter((i) => i.date > t || (i.date === t && (!i.end || i.end > now)) || (i.kind !== 'session' && i.date < t)).slice(0, 5);
  const hero = upcoming[0];
  const rest = upcoming.slice(1);
  const weekEnd = iso(addDays(startOfWeek(new Date()), 7));
  const mySessions = items.filter((i) => i.kind === 'session' && i.mine && i.date >= t && i.date < weekEnd).length;
  const myLoans = items.filter((i) => i.kind === 'loan' && i.mine).length;
  const myUses = uses.filter((u) => u.user_email === email).length;
  const mName = new Map(machines.map((m) => [m.id, m]));

  const summary = school?.is_demo ? "Estàs a l'escola de demostració: pots mirar-ho tot, però no s'hi pot modificar res." : [
    `${greeting()}, ${first}.`,
    myUses ? `Tens ${myUses === 1 ? 'una màquina' : `${myUses} màquines`} en marxa.` : '',
    mySessions ? `Aquesta setmana tens ${mySessions} ${mySessions === 1 ? 'sessió' : 'sessions'} a l'aula.` : '',
    myLoans ? `Tens ${myLoans === 1 ? 'un préstec' : `${myLoans} préstecs`} per retornar.` : '',
    !myUses && !mySessions && !myLoans ? (uses.length ? `Ara mateix hi ha ${uses.length} ${uses.length === 1 ? 'màquina' : 'màquines'} en ús a l'aula.` : "L'aula està tranquil·la.") : '',
  ].filter(Boolean).join(' ');

  const move = (n: number) => {
    if (view === 'week') { const d = addDays(parse(selected), 7 * n); setSelected(iso(d)); setCursor(d); }
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  };
  const title = view === 'week'
    ? `${days[0].getDate()} – ${days[6].toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}`
    : cursor.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });
  const dayItems = byDay.get(selected) ?? [];

  const tiles = [
    { module: 'maquines', to: '/r/maquines', label: 'Màquines', icon: Printer, key: 'maquines', tone: stats.machines_down ? 'hot' : '' },
    { module: 'prestecs', to: '/r/material', label: 'Material', icon: Bot, key: 'material', tone: '' },
    { module: 'espais', to: '/calendari', label: 'Calendari', icon: CalendarClock, key: 'calendari', tone: '' },
    { module: 'consumibles', to: '/r/consumibles', label: 'Estoc', icon: Package, key: 'consumibles', tone: stats.low_stock ? 'warm' : '' },
    { module: 'incidencies', to: '/r/incidencies', label: 'Incidències', icon: AlertTriangle, key: 'incidencies', tone: stats.urgent_incidents ? 'hot' : stats.open_incidents ? 'warm' : '' },
    { module: 'manteniment', to: '/r/manteniment', label: 'Manteniment', icon: Wrench, key: 'manteniment', tone: stats.maintenance_due ? 'warm' : '' },
  ].filter((x) => enabled.has(x.module));

  return (
    <section>
      <div className="home-head">
        <h1>{cap(new Date().toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</h1>
        <p>{summary}</p>
      </div>

      <div className="home-grid">
        <div className="panel">
          <div className="mcal-head">
            <h2>{cap(title)}</h2>
            <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft /></button>
            <button className="btn btn-sm" onClick={() => { setCursor(new Date()); setSelected(t); }}>Avui</button>
            <button className="icon-btn" onClick={() => move(1)} aria-label="Següent"><ChevronRight /></button>
            <div className="segmented">
              <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Setmana</button>
              <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Mes</button>
            </div>
          </div>
          <div className="mcal-grid">
            {DOW.map((d) => <div key={d} className="mcal-dow">{d}</div>)}
            {days.map((d) => {
              const k = iso(d);
              const evs = byDay.get(k) ?? [];
              const other = view === 'month' && d.getMonth() !== cursor.getMonth();
              return (
                <button key={k} className={`mcal-day ${evs.length ? 'has' : ''} ${other ? 'other' : ''} ${k === t ? 'today' : ''} ${k === selected ? 'sel' : ''}`}
                        onClick={() => setSelected(k)} aria-label={d.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}>
                  <span className="mcal-num">{d.getDate()}</span>
                  <span className="mcal-evs">
                    {evs.slice(0, 2).map((e) => <span key={e.id} className="mcal-ev"><i style={{ background: COLOR[e.kind] }} />{e.start ? e.start : ''} {e.title}</span>)}
                  </span>
                  {evs.length > 2 && <span className="mcal-more">+{evs.length - 2} més</span>}
                </button>
              );
            })}
          </div>
          <div className="agenda">
            {dayItems.length === 0 ? (
              <p className="muted small" style={{ padding: '6px 0' }}>
                {cap(parse(selected).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}: res programat.
                {!readOnly && enabled.has('espais') && <> <Link to={`/r/sessions?nou=1`}>Reserva l'aula</Link></>}
              </p>
            ) : dayItems.map((i) => (
              <Link key={i.id} to={i.to} className="agenda-item">
                <div className="agenda-date"><b>{parse(i.date).getDate()}</b><span>{parse(i.date).toLocaleDateString('ca-ES', { month: 'short' })}</span></div>
                <div className="t">
                  <b><i style={{ background: COLOR[i.kind] }} />{i.title}</b>
                  <span>{i.start ? `${i.start}–${i.end} · ` : ''}{i.sub}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="section-head"><h2>Properament</h2><Link to="/calendari" className="link">Tot el calendari</Link></div>
          {!hero ? <div className="panel muted">No hi ha res programat els propers dies.</div> : (
            <>
              <Link to={hero.to} className="panel next-hero" style={{ color: 'inherit', textDecoration: 'none' }}>
                <Ring big days={daysUntil(hero.date)} color={COLOR[hero.kind]} />
                <div className="t">
                  <b>{hero.title}</b>
                  <span>{cap(parse(hero.date).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }))}{hero.start ? `, ${hero.start}–${hero.end}` : ''}</span>
                  <span>{hero.sub}{hero.mine ? ' · és teu' : ''}</span>
                </div>
              </Link>
              <div className="next-list">
                {rest.map((i) => (
                  <div key={i.id} className="next-item">
                    <Ring days={daysUntil(i.date)} color={COLOR[i.kind]} />
                    <div className="t">
                      <b><i style={{ background: COLOR[i.kind] }} />{i.title}</b>
                      <span>{cap(parse(i.date).toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }))}{i.start ? `, ${i.start}–${i.end}` : ''}</span>
                      <span>{i.sub}</span>
                      <Link to={i.to} className="link">Obre <ArrowUpRight /></Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {uses.length > 0 && (
        <div className="block">
          <div className="section-head"><h2 className="live">Ara a l'aula</h2><Link to="/r/usos" className="link">Historial d'usos</Link></div>
          <div className="now">
            {uses.map((u) => {
              const m = mName.get(u.machine_id);
              return (
                <Link key={u.id} to="/r/maquines" className="now-card">
                  <div className="now-photo"><Photo path={m?.photo_path} icon={Printer} /></div>
                  <div style={{ minWidth: 0 }}>
                    <b>{m?.name ?? 'Màquina'}</b>
                    <span>{u.user_email === email ? 'Tu' : nameOf(u.user_email)} · des de les {fmtTime(u.start_time)}{u.planned_end_time ? `, fins a les ${fmtTime(u.planned_end_time)}` : ''}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="block">
          <div className="section-head"><h2>Avisos</h2></div>
          <div className="alerts">
            {alerts.map((a) => (
              <Link key={a.text} to={a.to} className={`alert ${a.tone}`}><a.icon /><span>{a.text}</span><span className="spacer" /><ChevronRight /></Link>
            ))}
          </div>
        </div>
      )}

      <div className="block">
        <div className="section-head"><h2>L'aula</h2></div>
        <div className="tiles">
          {tiles.map((x) => (
            <Link key={x.to} to={x.to} className={`tile ${x.tone}`}>
              <span className="ti"><x.icon /></span>
              <div><b>{x.label}</b><span>{counts[x.key] ?? ''}</span></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
