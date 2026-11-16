// =====================================================================
// Definició declarativa de totes les pantalles de dades.
// Per afegir un camp o una pantalla nova, normalment n'hi ha prou amb
// tocar aquest fitxer (i la migració SQL corresponent).
// =====================================================================
import type { Role } from './lib/school';
import { fmtDate, fmtDuration, fmtTime, minutesBetween, nowTime, today } from './lib/format';

export type Row = Record<string, any>;
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'email' | 'url' | 'bool'
  | 'select' | 'ref' | 'photo' | 'file';

export interface RefDef {
  table: string;
  select: string;                 // columnes a demanar, ha d'incloure id
  label: (r: Row) => string;
  activeOnly?: boolean;           // filtra active = true a les opcions
}

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];             // opcions fixes (estats)
  list?: string;                  // llista configurable del centre (list_items)
  ref?: RefDef;
  default?: () => unknown;
  staffOnly?: boolean;            // només admin/gestor el veuen al formulari
  showIf?: (values: Row) => boolean;
  help?: string;
  defaultMe?: boolean;            // per defecte, el correu de qui omple el formulari
}

export interface Column {
  label: string;
  value: (r: Row, refs: RefLabels) => string;
  tone?: (r: Row) => Tone | undefined;   // si hi és, es pinta com a etiqueta
  photo?: string;                          // nom del camp amb la ruta de la foto
  hideOnMobile?: boolean;
}

export type RefLabels = (field: string, id: unknown) => string;

export interface ActionCtx { role: Role | null; email: string; isStaff: boolean }

export type RowAction =
  | { label: string; show: (r: Row, c: ActionCtx) => boolean; kind: 'create'; resource: string; preset: (r: Row) => Row }
  | { label: string; show: (r: Row, c: ActionCtx) => boolean; kind: 'finish-use' }
  | { label: string; show: (r: Row, c: ActionCtx) => boolean; kind: 'edit'; preset: (r: Row) => Row }
  | { label: string; show: (r: Row, c: ActionCtx) => boolean; kind: 'update'; values: (r: Row) => Row; confirm?: string };

export interface CardDef {
  photo: string;
  title: (r: Row) => string;
  subtitle?: (r: Row, refs: RefLabels) => string;
  meta?: (r: Row, refs: RefLabels) => string;
  status: (r: Row) => { label: string; tone: Tone };
}

export interface QuickFilter { label: string; match: (r: Row) => boolean }

export interface Resource {
  key: string;
  module: string;
  title: string;
  singular: string;
  table: string;              // on s'escriu
  view?: string;              // d'on es llegeix (si és diferent)
  order: { column: string; ascending: boolean }[];
  columns: Column[];
  fields: Field[];
  search: (r: Row) => string;
  docentCreate: boolean;
  docentEditOwn: boolean;
  actions?: RowAction[];
  filters?: QuickFilter[];
  defaultFilter?: number;
  card?: CardDef;             // si hi és, es mostra com a graella de targetes amb foto     // índex del filtre actiu en obrir la pantalla
  hint?: string;
}

// ---------------------------------------------------------------------
// Opcions fixes (lligades a la lògica de la base de dades)
// ---------------------------------------------------------------------
const SESSION_STATUS = ['Programada', 'Realitzada', 'Cancel·lada'];
const PROJECT_STATUS = ['En preparació', 'Actiu', 'Finalitzat', 'Aturat'];
const MACHINE_STATUS = ['Operativa', 'En ús', 'Avaria', 'En manteniment', 'Fora de servei'];
const USE_FINAL = ['Correcte', 'Incidència', 'Necessita revisió'];
const MAINT_STATUS = ['Pendent', 'Programat', 'En curs', 'Realitzat', 'Cancel·lat'];
const PRIORITY = ['Baixa', 'Mitjana', 'Alta', 'Urgent'];
const INC_STATUS = ['Pendent', 'En revisió', 'En reparació', 'Resolta', 'No procedeix'];
const MATERIAL_STATUS = ['Disponible', 'Deteriorat', 'En reparació', 'Fora de servei'];
const LOAN_STATUS = ['Prestat', 'Retornat', 'Perdut', 'Deteriorat'];
const MOVE_TYPES = ['Entrada', 'Sortida', 'Pèrdua o deteriorament', 'Ajust estoc'];

const tone = (map: Record<string, Tone>) => (r: Row, k = 'status') => map[r[k]] ?? 'muted';

// ---------------------------------------------------------------------
// Referències reutilitzables
// ---------------------------------------------------------------------
const REF = {
  space:    { table: 'spaces', select: 'id, name, active', label: (r) => r.name, activeOnly: true } as RefDef,
  project:  { table: 'projects', select: 'id, name', label: (r) => r.name } as RefDef,
  machine:  { table: 'machines', select: 'id, name, active', label: (r) => r.name, activeOnly: true } as RefDef,
  material: { table: 'materials', select: 'id, name, active', label: (r) => r.name, activeOnly: true } as RefDef,
  catalog:  { table: 'catalog_items', select: 'id, name, active', label: (r) => r.name, activeOnly: true } as RefDef,
  consumable: {
    table: 'consumables', select: 'id, variant_name, color, stock_unit, active',
    label: (r) => [r.variant_name, r.color].filter(Boolean).join(' - '), activeOnly: true,
  } as RefDef,
};

const notes: Field = { name: 'notes', label: 'Observacions', type: 'textarea' };
const active: Field = { name: 'active', label: 'Actiu', type: 'bool', default: () => true, staffOnly: true };
const photo: Field = { name: 'photo_path', label: 'Fotografia', type: 'photo' };
const own = (r: Row, c: ActionCtx) => c.isStaff || r.created_by === c.email;

// ---------------------------------------------------------------------
// Pantalles
// ---------------------------------------------------------------------
export const RESOURCES: Resource[] = [
  // ----------------------------------------------------------- Espais
  {
    key: 'sessions', defaultFilter: 0, module: 'espais', title: 'Sessions', singular: 'sessió', table: 'sessions',
    order: [{ column: 'session_date', ascending: false }, { column: 'start_time', ascending: true }],
    docentCreate: true, docentEditOwn: true,
    columns: [
      { label: 'Data', value: (r) => fmtDate(r.session_date) },
      { label: 'Hora', value: (r) => `${fmtTime(r.start_time)}–${fmtTime(r.end_time)}` },
      { label: 'Espai', value: (r, ref) => ref('space_id', r.space_id) },
      { label: 'Grup', value: (r) => r.group_name ?? '', hideOnMobile: true },
      { label: 'Projecte', value: (r, ref) => ref('project_id', r.project_id), hideOnMobile: true },
      { label: 'Docent', value: (r) => r.teacher_email ?? '', hideOnMobile: true },
      { label: 'Estat', value: (r) => r.status, tone: (r) => tone({ Programada: 'info', Realitzada: 'ok', 'Cancel·lada': 'muted' })(r) },
    ],
    fields: [
      { name: 'session_date', label: 'Data', type: 'date', required: true, default: today },
      { name: 'start_time', label: 'Hora d\'inici', type: 'time', required: true },
      { name: 'end_time', label: 'Hora de fi', type: 'time', required: true },
      { name: 'space_id', label: 'Espai', type: 'ref', ref: REF.space },
      { name: 'group_name', label: 'Grup', type: 'select', list: 'grups' },
      { name: 'project_id', label: 'Projecte', type: 'ref', ref: REF.project },
      { name: 'activity', label: 'Activitat', type: 'textarea' },
      { name: 'teacher_email', label: 'Docent', type: 'email', defaultMe: true },
      { name: 'status', label: 'Estat', type: 'select', options: SESSION_STATUS, default: () => 'Programada' },
      notes,
    ],
    filters: [
      { label: 'Avui i properes', match: (r) => r.session_date >= today() && r.status !== 'Cancel·lada' },
      { label: 'Avui', match: (r) => r.session_date === today() },
    ],
    search: (r) => `${r.activity ?? ''} ${r.group_name ?? ''} ${r.teacher_email ?? ''}`,
    hint: 'Si l\'espai ja està reservat en aquella franja, el sistema no et deixarà desar la sessió.',
  },
  {
    key: 'espais', module: 'espais', title: 'Espais', singular: 'espai', table: 'spaces',
    order: [{ column: 'name', ascending: true }],
    docentCreate: false, docentEditOwn: false,
    columns: [
      { label: 'Nom', value: (r) => r.name },
      { label: 'Ubicació', value: (r) => r.location ?? '' },
      { label: 'Capacitat', value: (r) => r.capacity ?? '', hideOnMobile: true },
      { label: 'Estat', value: (r) => (r.active ? 'Actiu' : 'Inactiu'), tone: (r) => (r.active ? 'ok' : 'muted') },
    ],
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true },
      { name: 'location', label: 'Ubicació', type: 'text' },
      { name: 'capacity', label: 'Capacitat', type: 'number' },
      { name: 'description', label: 'Descripció', type: 'textarea' },
      { name: 'equipment', label: 'Equipament', type: 'textarea' },
      { name: 'rules', label: 'Normes d\'ús', type: 'textarea' },
      active,
    ],
    search: (r) => `${r.name} ${r.location ?? ''}`,
  },

  // ----------------------------------------------------------- Projectes
  {
    key: 'projectes', module: 'projectes', title: 'Projectes', singular: 'projecte', table: 'projects',
    order: [{ column: 'start_date', ascending: false }],
    docentCreate: true, docentEditOwn: true,
    columns: [
      { label: 'Projecte', value: (r) => r.name },
      { label: 'Curs', value: (r) => r.course ?? '' },
      { label: 'Responsable', value: (r) => r.responsible_email ?? '', hideOnMobile: true },
      { label: 'Dates', value: (r) => [fmtDate(r.start_date), fmtDate(r.end_date)].filter(Boolean).join(' → '), hideOnMobile: true },
      { label: 'Estat', value: (r) => r.status, tone: (r) => tone({ Actiu: 'ok', 'En preparació': 'info', Finalitzat: 'muted', Aturat: 'warn' })(r) },
    ],
    fields: [
      { name: 'name', label: 'Nom del projecte', type: 'text', required: true },
      { name: 'status', label: 'Estat', type: 'select', options: PROJECT_STATUS, default: () => 'En preparació' },
      { name: 'course', label: 'Curs', type: 'select', list: 'grups' },
      { name: 'groups', label: 'Grups', type: 'text', help: 'Per exemple: 5è A, 5è B' },
      { name: 'responsible_email', label: 'Responsable', type: 'email' },
      { name: 'start_date', label: 'Data d\'inici', type: 'date' },
      { name: 'end_date', label: 'Data final', type: 'date' },
      { name: 'description', label: 'Descripció', type: 'textarea' },
      { name: 'final_product', label: 'Producte final', type: 'text' },
    ],
    filters: [{ label: 'Actius', match: (r) => r.status === 'Actiu' || r.status === 'En preparació' }],
    search: (r) => `${r.name} ${r.course ?? ''} ${r.groups ?? ''}`,
  },

  // ----------------------------------------------------------- Màquines
  {
    key: 'maquines', module: 'maquines', title: 'Màquines', singular: 'màquina', table: 'machines',
    order: [{ column: 'name', ascending: true }],
    docentCreate: false, docentEditOwn: false,
    columns: [
      { label: '', value: () => '', photo: 'photo_path' },
      { label: 'Màquina', value: (r) => r.name },
      { label: 'Categoria', value: (r) => r.category ?? '', hideOnMobile: true },
      { label: 'Ubicació', value: (r) => r.location ?? '', hideOnMobile: true },
      { label: 'Estat', value: (r) => r.status, tone: (r) => tone({ Operativa: 'ok', 'En ús': 'info', Avaria: 'bad', 'En manteniment': 'warn', 'Fora de servei': 'muted' })(r) },
    ],
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true },
      { name: 'brand_model', label: 'Marca i model', type: 'text' },
      { name: 'category', label: 'Categoria', type: 'select', list: 'cat_maquines' },
      { name: 'location', label: 'Ubicació', type: 'text' },
      { name: 'status', label: 'Estat', type: 'select', options: MACHINE_STATUS, default: () => 'Operativa' },
      { name: 'responsible_email', label: 'Responsable', type: 'email' },
      { name: 'manual_url', label: 'Manual (enllaç)', type: 'url' },
      { name: 'instructions_url', label: 'Instruccions (enllaç)', type: 'url' },
      { name: 'acquired_on', label: 'Data d\'adquisició', type: 'date' },
      { name: 'last_review_on', label: 'Última revisió', type: 'date' },
      photo, notes, active,
    ],
    card: {
      photo: 'photo_path',
      title: (r) => r.name,
      subtitle: (r) => r.brand_model ?? '',
      meta: (r) => [r.category, r.location].filter(Boolean).join(' · '),
      status: (r) => ({ label: r.status, tone: tone({ Operativa: 'ok', 'En ús': 'info', Avaria: 'bad', 'En manteniment': 'warn', 'Fora de servei': 'muted' })(r) }),
    },
    actions: [
      { label: 'Iniciar ús', kind: 'create', resource: 'usos', show: (r) => r.status === 'Operativa' && r.active,
        preset: (r) => ({ machine_id: r.id }) },
      { label: 'Finalitzar ús', kind: 'finish-use', show: (r) => r.status === 'En ús' },
      { label: 'Incidència', kind: 'create', resource: 'incidencies', show: () => true,
        preset: (r) => ({ machine_id: r.id, type: 'Màquina' }) },
    ],
    filters: [{ label: 'Operatives', match: (r) => r.status === 'Operativa' }, { label: 'Amb problemes', match: (r) => ['Avaria', 'Fora de servei', 'En manteniment'].includes(r.status) }],
    search: (r) => `${r.name} ${r.brand_model ?? ''} ${r.category ?? ''}`,
  },
  {
    key: 'usos', module: 'maquines', title: 'Usos de màquines', singular: 'ús de màquina', table: 'machine_uses',
    order: [{ column: 'use_date', ascending: false }, { column: 'start_time', ascending: false }],
    docentCreate: true, docentEditOwn: true,
    columns: [
      { label: 'Data', value: (r) => fmtDate(r.use_date) },
      { label: 'Màquina', value: (r, ref) => ref('machine_id', r.machine_id) },
      { label: 'Qui', value: (r) => r.user_email ?? '', hideOnMobile: true },
      { label: 'Horari', value: (r) => `${fmtTime(r.start_time)}–${fmtTime(r.end_time) || '…'}` },
      { label: 'Durada', value: (r) => fmtDuration(minutesBetween(fmtTime(r.start_time), fmtTime(r.end_time))), hideOnMobile: true },
      { label: 'Estat', value: (r) => (r.end_time ? r.final_status ?? 'Finalitzat' : 'En curs'),
        tone: (r) => (!r.end_time ? 'info' : r.final_status === 'Incidència' ? 'bad' : r.final_status === 'Necessita revisió' ? 'warn' : 'ok') },
    ],
    fields: [
      { name: 'machine_id', label: 'Màquina', type: 'ref', ref: REF.machine, required: true },
      { name: 'use_date', label: 'Data', type: 'date', default: today, required: true },
      { name: 'start_time', label: 'Hora d\'inici', type: 'time', default: nowTime, required: true },
      { name: 'planned_end_time', label: 'Hora prevista de fi', type: 'time' },
      { name: 'end_time', label: 'Hora de fi', type: 'time', help: 'Deixa-ho buit mentre la màquina estigui en ús' },
      { name: 'project_id', label: 'Projecte', type: 'ref', ref: REF.project },
      { name: 'material_id', label: 'Material utilitzat', type: 'ref', ref: REF.material },
      { name: 'final_status', label: 'Com ha anat?', type: 'select', options: USE_FINAL, showIf: (v) => Boolean(v.end_time),
        help: 'Si marques "Incidència" se\'n crearà una automàticament' },
      { name: 'user_email', label: 'Usuari', type: 'email', staffOnly: true, defaultMe: true },
      notes,
    ],
    actions: [
      { label: 'Finalitzar', kind: 'edit', show: (r, c) => !r.end_time && own(r, c),
        preset: () => ({ end_time: nowTime(), final_status: 'Correcte' }) },
    ],
    filters: [{ label: 'En curs', match: (r) => !r.end_time }, { label: 'Avui', match: (r) => r.use_date === today() }],
    search: (r) => `${r.user_email ?? ''} ${r.notes ?? ''}`,
  },

  // ----------------------------------------------------------- Manteniment
  {
    key: 'manteniment', defaultFilter: 0, module: 'manteniment', title: 'Manteniment', singular: 'tasca de manteniment', table: 'maintenance',
    order: [{ column: 'planned_on', ascending: true }],
    docentCreate: true, docentEditOwn: false,
    columns: [
      { label: 'Màquina', value: (r, ref) => ref('machine_id', r.machine_id) },
      { label: 'Tasca', value: (r) => r.task },
      { label: 'Tipus', value: (r) => r.type ?? '', hideOnMobile: true },
      { label: 'Prevista', value: (r) => fmtDate(r.planned_on) },
      { label: 'Periodicitat', value: (r) => r.periodicity ?? '', hideOnMobile: true },
      { label: 'Estat', value: (r) => r.status,
        tone: (r) => (r.status === 'Realitzat' ? 'ok' : r.status === 'Cancel·lat' ? 'muted'
          : r.planned_on && r.planned_on < today() ? 'bad' : r.status === 'En curs' ? 'warn' : 'info') },
    ],
    fields: [
      { name: 'machine_id', label: 'Màquina', type: 'ref', ref: REF.machine, required: true },
      { name: 'task', label: 'Tasca', type: 'text', required: true },
      { name: 'type', label: 'Tipus', type: 'select', list: 'tipus_manteniment' },
      { name: 'periodicity', label: 'Periodicitat', type: 'select', list: 'periodicitats',
        help: 'En marcar-la com a realitzada es programarà automàticament la següent' },
      { name: 'planned_on', label: 'Data prevista', type: 'date' },
      { name: 'status', label: 'Estat', type: 'select', options: MAINT_STATUS, default: () => 'Pendent', staffOnly: true },
      { name: 'done_on', label: 'Data de realització', type: 'date', staffOnly: true },
      { name: 'responsible_email', label: 'Responsable', type: 'email' },
      { name: 'action_description', label: 'Què s\'ha fet', type: 'textarea', staffOnly: true },
      { name: 'next_review_on', label: 'Propera revisió', type: 'date', staffOnly: true },
      photo, notes,
    ],
    actions: [
      { label: 'Fet', kind: 'edit', show: (r, c) => c.isStaff && !['Realitzat', 'Cancel·lat'].includes(r.status),
        preset: () => ({ status: 'Realitzat', done_on: today() }) },
    ],
    filters: [
      { label: 'Pendents', match: (r) => ['Pendent', 'Programat', 'En curs'].includes(r.status) },
      { label: 'Endarrerides', match: (r) => ['Pendent', 'Programat'].includes(r.status) && r.planned_on && r.planned_on < today() },
    ],
    search: (r) => `${r.task} ${r.type ?? ''}`,
  },

  // ----------------------------------------------------------- Incidències
  {
    key: 'incidencies', defaultFilter: 0, module: 'incidencies', title: 'Incidències', singular: 'incidència', table: 'incidents',
    order: [{ column: 'inc_date', ascending: false }, { column: 'inc_time', ascending: false }],
    docentCreate: true, docentEditOwn: false,
    columns: [
      { label: 'Data', value: (r) => fmtDate(r.inc_date) },
      { label: 'Element', value: (r, ref) => ref('machine_id', r.machine_id) || ref('material_id', r.material_id) || ref('space_id', r.space_id) || r.affected_item || r.type || '' },
      { label: 'Descripció', value: (r) => r.description, hideOnMobile: true },
      { label: 'Prioritat', value: (r) => r.priority, tone: (r) => tone({ Baixa: 'muted', Mitjana: 'info', Alta: 'warn', Urgent: 'bad' })(r, 'priority') },
      { label: 'Estat', value: (r) => r.status, tone: (r) => tone({ Pendent: 'bad', 'En revisió': 'warn', 'En reparació': 'warn', Resolta: 'ok', 'No procedeix': 'muted' })(r) },
    ],
    fields: [
      { name: 'type', label: 'Tipus', type: 'select', list: 'tipus_incidencia' },
      { name: 'machine_id', label: 'Màquina', type: 'ref', ref: REF.machine },
      { name: 'material_id', label: 'Material', type: 'ref', ref: REF.material },
      { name: 'space_id', label: 'Espai', type: 'ref', ref: REF.space },
      { name: 'affected_item', label: 'Un altre element', type: 'text', help: 'Si no és cap màquina, material ni espai de la llista' },
      { name: 'description', label: 'Què passa?', type: 'textarea', required: true },
      photo,
      { name: 'priority', label: 'Prioritat', type: 'select', options: PRIORITY, default: () => 'Mitjana',
        help: 'Alta o Urgent posa la màquina en estat "Avaria"' },
      { name: 'status', label: 'Estat', type: 'select', options: INC_STATUS, default: () => 'Pendent', staffOnly: true },
      { name: 'responsible_email', label: 'Responsable', type: 'email', staffOnly: true },
      { name: 'resolution', label: 'Resolució', type: 'textarea', staffOnly: true },
      { name: 'resolved_on', label: 'Data de resolució', type: 'date', staffOnly: true },
      { name: 'notes', label: 'Observacions', type: 'textarea', staffOnly: true },
    ],
    filters: [{ label: 'Obertes', match: (r) => !['Resolta', 'No procedeix'].includes(r.status) }],
    search: (r) => `${r.description} ${r.affected_item ?? ''} ${r.type ?? ''}`,
  },

  // ----------------------------------------------------------- Préstecs
  {
    key: 'material', module: 'prestecs', title: 'Material de préstec', singular: 'material', table: 'materials', view: 'materials_availability',
    order: [{ column: 'category', ascending: true }, { column: 'name', ascending: true }],
    docentCreate: false, docentEditOwn: false,
    columns: [
      { label: '', value: () => '', photo: 'photo_path' },
      { label: 'Material', value: (r) => r.name },
      { label: 'Categoria', value: (r) => r.category ?? '', hideOnMobile: true },
      { label: 'Disponibles', value: (r) => `${r.available_qty} / ${r.total_qty}`,
        tone: (r) => (r.status !== 'Disponible' ? 'muted' : r.available_qty > 0 ? 'ok' : 'bad') },
      { label: 'Estat', value: (r) => r.status, hideOnMobile: true },
    ],
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true },
      { name: 'category', label: 'Categoria', type: 'select', list: 'cat_materials' },
      { name: 'total_qty', label: 'Quantitat total', type: 'number', required: true, default: () => 1 },
      { name: 'location', label: 'Ubicació', type: 'text' },
      { name: 'status', label: 'Estat', type: 'select', options: MATERIAL_STATUS, default: () => 'Disponible' },
      { name: 'description', label: 'Descripció', type: 'textarea' },
      photo, notes, active,
    ],
    card: {
      photo: 'photo_path',
      title: (r) => r.name,
      subtitle: (r) => r.description ?? '',
      meta: (r) => [r.category, r.location].filter(Boolean).join(' · '),
      status: (r) => r.status !== 'Disponible'
        ? { label: r.status, tone: 'muted' }
        : r.available_qty > 0
          ? { label: r.total_qty > 1 ? `${r.available_qty} de ${r.total_qty} disponibles` : 'Disponible', tone: 'ok' }
          : { label: 'Prestat', tone: 'info' },
    },
    actions: [
      { label: 'Prestar', kind: 'create', resource: 'prestecs', show: (r) => r.available_qty > 0 && r.status === 'Disponible',
        preset: (r) => ({ material_id: r.id }) },
    ],
    filters: [{ label: 'Disponibles', match: (r) => r.available_qty > 0 && r.status === 'Disponible' }],
    search: (r) => `${r.name} ${r.category ?? ''}`,
  },
  {
    key: 'prestecs', defaultFilter: 0, module: 'prestecs', title: 'Préstecs', singular: 'préstec', table: 'loans',
    order: [{ column: 'out_date', ascending: false }],
    docentCreate: true, docentEditOwn: true,
    columns: [
      { label: 'Material', value: (r, ref) => ref('material_id', r.material_id) },
      { label: 'Qui', value: (r) => r.borrower_email ?? '' },
      { label: 'Quantitat', value: (r) => String(r.qty), hideOnMobile: true },
      { label: 'Sortida', value: (r) => fmtDate(r.out_date), hideOnMobile: true },
      { label: 'Retorn previst', value: (r) => fmtDate(r.due_date),
        tone: (r) => (r.status === 'Prestat' && r.due_date && r.due_date < today() ? 'bad' : undefined) },
      { label: 'Estat', value: (r) => r.status, tone: (r) => tone({ Prestat: 'info', Retornat: 'ok', Perdut: 'bad', Deteriorat: 'warn' })(r) },
    ],
    fields: [
      { name: 'material_id', label: 'Material', type: 'ref', ref: REF.material, required: true },
      { name: 'qty', label: 'Quantitat', type: 'number', required: true, default: () => 1 },
      { name: 'borrower_email', label: 'Qui s\'ho emporta', type: 'email', defaultMe: true },
      { name: 'out_date', label: 'Data de sortida', type: 'date', default: today, required: true },
      { name: 'due_date', label: 'Data de retorn prevista', type: 'date' },
      { name: 'status', label: 'Estat', type: 'select', options: LOAN_STATUS, default: () => 'Prestat' },
      { name: 'returned_on', label: 'Data de retorn', type: 'date', showIf: (v) => v.status !== 'Prestat' },
      notes,
    ],
    actions: [
      { label: 'Retornat', kind: 'update', show: (r, c) => r.status === 'Prestat' && own(r, c),
        values: () => ({ status: 'Retornat' }) },
    ],
    filters: [
      { label: 'Pendents', match: (r) => r.status === 'Prestat' },
      { label: 'Endarrerits', match: (r) => r.status === 'Prestat' && r.due_date && r.due_date < today() },
    ],
    search: (r) => `${r.borrower_email ?? ''} ${r.notes ?? ''}`,
  },

  // ----------------------------------------------------------- Consumibles
  {
    key: 'consumibles', module: 'consumibles', title: 'Consumibles', singular: 'consumible', table: 'consumables', view: 'consumables_stock',
    order: [{ column: 'variant_name', ascending: true }],
    docentCreate: false, docentEditOwn: false,
    columns: [
      { label: '', value: () => '', photo: 'photo_path' },
      { label: 'Consumible', value: (r) => r.full_name },
      { label: 'Catàleg', value: (r) => r.catalog_name ?? '', hideOnMobile: true },
      { label: 'Estoc', value: (r) => `${Number(r.current_stock)} ${r.stock_unit}` },
      { label: 'Mínim', value: (r) => String(Number(r.min_stock)), hideOnMobile: true },
      { label: 'Estat', value: (r) => r.stock_status, tone: (r) => tone({ Correcte: 'ok', 'Cal reposar': 'warn', 'Sense estoc': 'bad' })(r, 'stock_status') },
    ],
    fields: [
      { name: 'catalog_id', label: 'Material del catàleg', type: 'ref', ref: REF.catalog },
      { name: 'variant_name', label: 'Nom de la variant', type: 'text', required: true, help: 'Per exemple: PLA, DM 3 mm, Vinil mat' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'finish', label: 'Acabat', type: 'text' },
      { name: 'format', label: 'Format', type: 'select', list: 'formats' },
      { name: 'stock_unit', label: 'Unitat d\'estoc', type: 'select', list: 'unitats', required: true, default: () => 'Unitats' },
      { name: 'min_stock', label: 'Estoc mínim', type: 'number', default: () => 0 },
      { name: 'thickness_mm', label: 'Gruix (mm)', type: 'number' },
      { name: 'width_mm', label: 'Amplada (mm)', type: 'number' },
      { name: 'length_mm', label: 'Llargada (mm)', type: 'number' },
      { name: 'location', label: 'Ubicació', type: 'text' },
      photo, notes, active,
    ],
    card: {
      photo: 'photo_path',
      title: (r) => r.full_name,
      subtitle: (r) => `${Number(r.current_stock)} ${String(r.stock_unit ?? '').toLowerCase()} · mínim ${Number(r.min_stock)}`,
      meta: (r) => [r.catalog_name, r.location].filter(Boolean).join(' · '),
      status: (r) => ({ label: r.stock_status, tone: tone({ Correcte: 'ok', 'Cal reposar': 'warn', 'Sense estoc': 'bad' })(r, 'stock_status') }),
    },
    actions: [
      { label: 'Consum', kind: 'create', resource: 'moviments', show: (r) => Number(r.current_stock) > 0,
        preset: (r) => ({ consumable_id: r.id, type: 'Sortida' }) },
      { label: 'Entrada', kind: 'create', resource: 'moviments', show: (_r, c) => c.isStaff,
        preset: (r) => ({ consumable_id: r.id, type: 'Entrada' }) },
    ],
    filters: [{ label: 'Cal reposar', match: (r) => r.active && r.stock_status !== 'Correcte' }],
    search: (r) => `${r.full_name} ${r.catalog_name ?? ''} ${r.location ?? ''}`,
    hint: 'L\'estoc es calcula sol a partir de les entrades, sortides, pèrdues i ajustos.',
  },
  {
    key: 'moviments', module: 'consumibles', title: 'Moviments d\'estoc', singular: 'moviment', table: 'consumable_movements',
    order: [{ column: 'mov_date', ascending: false }, { column: 'created_at', ascending: false }],
    docentCreate: true, docentEditOwn: false,
    columns: [
      { label: 'Data', value: (r) => fmtDate(r.mov_date) },
      { label: 'Consumible', value: (r, ref) => ref('consumable_id', r.consumable_id) },
      { label: 'Tipus', value: (r) => r.type, tone: (r) => tone({ Entrada: 'ok', Sortida: 'info', 'Pèrdua o deteriorament': 'bad', 'Ajust estoc': 'muted' })(r, 'type') },
      { label: 'Quantitat', value: (r) => String(Number(r.qty)) },
      { label: 'Projecte', value: (r, ref) => ref('project_id', r.project_id), hideOnMobile: true },
      { label: 'Qui', value: (r) => r.user_email ?? '', hideOnMobile: true },
    ],
    fields: [
      { name: 'consumable_id', label: 'Consumible', type: 'ref', ref: REF.consumable, required: true },
      { name: 'type', label: 'Tipus de moviment', type: 'select', options: MOVE_TYPES, required: true, default: () => 'Sortida' },
      { name: 'qty', label: 'Quantitat', type: 'number', required: true, default: () => 1,
        help: 'En un ajust, posa un número negatiu per restar estoc' },
      { name: 'mov_date', label: 'Data', type: 'date', default: today, required: true },
      { name: 'project_id', label: 'Projecte', type: 'ref', ref: REF.project, showIf: (v) => v.type !== 'Entrada' },
      { name: 'supplier', label: 'Proveïdor', type: 'text', showIf: (v) => v.type === 'Entrada' },
      { name: 'total_price', label: 'Preu total (€)', type: 'number', showIf: (v) => v.type === 'Entrada' },
      { name: 'purchase_doc_path', label: 'Factura o albarà', type: 'file', showIf: (v) => v.type === 'Entrada' },
      notes,
    ],
    filters: [{ label: 'Consum', match: (r) => r.type === 'Sortida' }, { label: 'Entrades', match: (r) => r.type === 'Entrada' }],
    search: (r) => `${r.type} ${r.supplier ?? ''} ${r.user_email ?? ''}`,
  },
  {
    key: 'cataleg', module: 'consumibles', title: 'Catàleg', singular: 'material del catàleg', table: 'catalog_items',
    order: [{ column: 'category', ascending: true }, { column: 'name', ascending: true }],
    docentCreate: false, docentEditOwn: false,
    columns: [
      { label: '', value: () => '', photo: 'photo_path' },
      { label: 'Material', value: (r) => r.name },
      { label: 'Categoria', value: (r) => r.category ?? '' },
      { label: 'Compatible amb', value: (r) => r.compatibility ?? '', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', label: 'Nom', type: 'text', required: true },
      { name: 'category', label: 'Categoria', type: 'select', list: 'cat_cataleg' },
      { name: 'description', label: 'Descripció', type: 'textarea' },
      { name: 'uses', label: 'Usos', type: 'textarea' },
      { name: 'compatibility', label: 'Compatibilitat', type: 'text', help: 'Amb quines màquines es pot fer servir' },
      photo, active,
    ],
    card: {
      photo: 'photo_path',
      title: (r) => r.name,
      subtitle: (r) => r.description ?? '',
      meta: (r) => r.category ?? '',
      status: (r) => (r.active ? { label: r.compatibility ? `Per a ${r.compatibility.replace(/\.$/, '')}` : 'Actiu', tone: 'ok' } : { label: 'Inactiu', tone: 'muted' }),
    },
    search: (r) => `${r.name} ${r.category ?? ''} ${r.uses ?? ''}`,
  },
];

export const resourceByKey = (k: string) => RESOURCES.find((r) => r.key === k);

export function canCreate(res: Resource, role: Role | null) {
  if (!role) return false;
  return role !== 'docent' || res.docentCreate;
}

export function canEdit(res: Resource, row: Row, role: Role | null, email: string) {
  if (!role) return false;
  if (role !== 'docent') return true;
  return res.docentEditOwn && row.created_by === email;
}

export const canDelete = (role: Role | null) => role === 'admin' || role === 'gestor';
