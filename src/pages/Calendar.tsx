import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import caLocale from '@fullcalendar/core/locales/ca';
import type { EventClickArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { useSchool } from '../lib/school';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fmtTime, today } from '../lib/format';
import { canCreate, canEdit, resourceByKey, type Row } from '../resources';
import { useRefs } from '../components/useRefs';
import RecordForm from '../components/RecordForm';
import { Modal, Status, toast } from '../components/ui';

type Kind = 'session' | 'maintenance' | 'loan';
const KINDS: { kind: Kind; module: string; label: string; color: string }[] = [
  { kind: 'session', module: 'espais', label: 'Sessions', color: 'var(--accent)' },
  { kind: 'maintenance', module: 'manteniment', label: 'Manteniment', color: '#b26b00' },
  { kind: 'loan', module: 'prestecs', label: 'Retorns de préstecs', color: '#2d5ea8' },
];
const BAD = '#c43d32';
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
const addHour = (t: string) => { const [h, m] = t.split(':').map(Number); return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

export default function Calendar() {
  const { school, enabled, role, readOnly, members } = useSchool();
  const { email } = useAuth();
  const nav = useNavigate();
  const cal = useRef<FullCalendar>(null);
  const sessions = resourceByKey('sessions')!;
  const { refs, label } = useRefs([sessions], school?.id);
  const available = KINDS.filter((k) => enabled.has(k.module));
  const [on, setOn] = useState<Set<Kind>>(new Set(available.map((k) => k.kind)));
  const [form, setForm] = useState<{ row?: Row; preset?: Row } | null>(null);
  const [info, setInfo] = useState<Row | null>(null);
  const nameOf = (mail?: string | null) => (mail ? members.find((m) => m.email === mail)?.full_name ?? mail : '');
  const canAdd = !readOnly && canCreate(sessions, role) && enabled.has('espais');

  const source = useMemo(() => async (arg: EventSourceFuncArg): Promise<EventInput[]> => {
    if (!school) return [];
    const from = arg.startStr.slice(0, 10);
    const to = arg.endStr.slice(0, 10);
    const out: EventInput[] = [];
    const jobs: Promise<void>[] = [];
    const t = today();

    if (on.has('session') && enabled.has('espais')) {
      jobs.push(Promise.resolve(supabase.from('sessions').select('*').eq('school_id', school.id)
        .gte('session_date', from).lt('session_date', to).neq('status', 'Cancel·lada')).then(({ data }) => {
        for (const s of (data as Row[]) ?? []) {
          out.push({
            id: 's' + s.id, title: s.activity || s.group_name || 'Sessió',
            start: `${s.session_date}T${s.start_time}`, end: `${s.session_date}T${s.end_time}`,
            backgroundColor: s.status === 'Realitzada' ? 'rgba(12,12,11,.35)' : 'var(--accent)', textColor: 'var(--accent-ink)',
            extendedProps: { kind: 'session', row: s },
          });
        }
      }));
    }
    if (on.has('maintenance') && enabled.has('manteniment')) {
      jobs.push(Promise.all([
        supabase.from('maintenance').select('id, task, planned_on, status, machine_id').eq('school_id', school.id)
          .in('status', ['Pendent', 'Programat', 'En curs']).gte('planned_on', from).lt('planned_on', to),
        supabase.from('machines').select('id, name').eq('school_id', school.id),
      ]).then(([mt, mq]) => {
        const names = new Map(((mq.data as Row[]) ?? []).map((m) => [m.id, m.name]));
        for (const m of (mt.data as Row[]) ?? []) {
          out.push({
            id: 'm' + m.id, title: `${m.task} · ${names.get(m.machine_id) ?? ''}`, start: m.planned_on, allDay: true,
            backgroundColor: m.planned_on < t ? BAD : '#b26b00', textColor: '#fff', extendedProps: { kind: 'maintenance', row: m },
          });
        }
      }));
    }
    if (on.has('loan') && enabled.has('prestecs')) {
      jobs.push(Promise.all([
        supabase.from('loans').select('id, material_id, qty, due_date, borrower_email').eq('school_id', school.id)
          .eq('status', 'Prestat').gte('due_date', from).lt('due_date', to),
        supabase.from('materials').select('id, name').eq('school_id', school.id),
      ]).then(([l, mt]) => {
        const names = new Map(((mt.data as Row[]) ?? []).map((m) => [m.id, m.name]));
        for (const x of (l.data as Row[]) ?? []) {
          out.push({
            id: 'l' + x.id, title: `Retorn: ${names.get(x.material_id) ?? 'material'}${x.qty > 1 ? ` ×${x.qty}` : ''}`,
            start: x.due_date, allDay: true, backgroundColor: x.due_date < t ? BAD : '#2d5ea8', textColor: '#fff',
            extendedProps: { kind: 'loan', row: x },
          });
        }
      }));
    }
    await Promise.all(jobs);
    return out;
  }, [school?.id, enabled, on]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDate(a: DateClickArg) {
    if (!canAdd) return;
    const date = a.dateStr.slice(0, 10);
    const time = a.allDay ? '09:00' : a.dateStr.slice(11, 16);
    setForm({ preset: { session_date: date, start_time: time, end_time: addHour(time) } });
  }

  function onEvent(a: EventClickArg) {
    const { kind, row } = a.event.extendedProps as { kind: Kind; row: Row };
    if (kind === 'maintenance') return nav('/r/manteniment');
    if (kind === 'loan') return nav('/r/prestecs');
    if (!readOnly && canEdit(sessions, row, role, email)) setForm({ row });
    else setInfo(row);
  }

  const toggle = (k: Kind) => setOn((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <section>
      <header className="page-head">
        <div>
          <span className="eyebrow">Planificació</span>
          <h1>Calendari</h1>
          <p>{canAdd ? 'Toca un dia o una hora lliure per reservar l\'aula.' : 'Sessions, manteniment i retorns de material.'}</p>
        </div>
        {canAdd && <button className="btn btn-primary" onClick={() => setForm({ preset: {} })}>+ Reserva</button>}
      </header>

      {available.length > 1 && (
        <div className="toolbar cal-legend">
          {available.map((k) => (
            <button key={k.kind} className={`cal-toggle ${on.has(k.kind) ? '' : 'off'}`} onClick={() => toggle(k.kind)}>
              <i style={{ background: k.color }} />{k.label}
            </button>
          ))}
        </div>
      )}

      <div className="cal-wrap">
        <FullCalendar
          ref={cal}
          key={[...on].join()}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={caLocale}
          firstDay={1}
          initialView={isMobile() ? 'listWeek' : 'dayGridMonth'}
          headerToolbar={isMobile()
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'title', center: '', right: 'dayGridMonth,timeGridWeek,listWeek today prev,next' }}
          footerToolbar={isMobile() ? { center: 'listWeek,timeGridDay,dayGridMonth' } : undefined}
          buttonText={{ today: 'Avui', month: 'Mes', week: 'Setmana', day: 'Dia', list: 'Llista' }}
          views={{ listWeek: { buttonText: 'Llista' }, timeGridDay: { buttonText: 'Dia' } }}
          slotMinTime="08:00:00"
          slotMaxTime="19:00:00"
          allDaySlot
          allDayText="Tot el dia"
          nowIndicator
          height="auto"
          dayMaxEvents={3}
          eventDisplay="block"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          noEventsText="Res programat aquests dies"
          events={source}
          dateClick={onDate}
          eventClick={onEvent}
        />
      </div>

      {form && (
        <RecordForm
          resource={sessions} row={form.row} preset={form.preset} refs={refs}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); toast('Desat'); cal.current?.getApi().refetchEvents(); }}
        />
      )}
      {info && (
        <Modal title="Sessió" onClose={() => setInfo(null)}>
          <span className="label">{new Date(info.session_date + 'T00:00:00').toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h2 className="detail-title">{fmtTime(info.start_time)}–{fmtTime(info.end_time)}</h2>
          <Status tone={info.status === 'Realitzada' ? 'ok' : 'info'}>{info.status}</Status>
          <dl className="detail">
            <div><dt>Activitat</dt><dd>{info.activity || '—'}</dd></div>
            <div><dt>Grup</dt><dd>{info.group_name || '—'}</dd></div>
            <div><dt>Espai</dt><dd>{label('space_id', info.space_id) || '—'}</dd></div>
            <div><dt>Projecte</dt><dd>{label('project_id', info.project_id) || '—'}</dd></div>
            <div><dt>Docent</dt><dd>{nameOf(info.teacher_email) || '—'}</dd></div>
          </dl>
        </Modal>
      )}
    </section>
  );
}
