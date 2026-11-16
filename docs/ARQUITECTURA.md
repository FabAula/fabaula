# Arquitectura

## Multi-centre

- Cada taula de dades té `school_id`.
- Les referències entre taules són **compostes** (`(machine_id, school_id) → machines(id, school_id)`). Així és impossible, fins i tot per error, enllaçar dades de dos centres.
- Els triggers que validen dades també filtren per centre, perquè un missatge d'error no reveli res d'un altre centre.

## Qui pot fer què

La seguretat és a la base de dades (RLS). La interfície només amaga els botons que no pots fer servir.

| | Llegir | Crear | Editar | Esborrar |
|---|---|---|---|---|
| **admin** | tot el centre | tot | tot + usuaris, mòduls i llistes | tot |
| **gestor** | tot el centre | tot | tot | tot |
| **docent** | tot el centre | sessions, projectes, usos, manteniment, incidències, préstecs, moviments d'estoc | només el que ha creat ell: sessions, projectes, usos, préstecs | — |
| **qualsevol usuari** | l'escola de demo | — | — | — |
| **admin de plataforma** | llista de centres i membres | centres | membres i mòduls de qualsevol centre | centres |

Altres regles:

- Un mòdul desactivat deixa d'existir per a l'API: no es pot llegir ni escriure.
- `created_by` el posa sempre el servidor i ningú no el pot canviar.
- Un centre no es pot quedar sense cap admin actiu.

Totes aquestes regles tenen test a `supabase/tests/rls.test.mjs`.

## Lògica que abans feia AppSheet

| AppSheet | Ara |
|---|---|
| Columnes virtuals d'estoc i disponibilitat | Vistes `consumables_stock` i `materials_availability` (`security_invoker`, respecten RLS) |
| `Valid_If` de quantitats | Triggers `tg_consumable_movement_check` i `tg_loan_check` |
| Slices (préstecs endarrerits, estoc per reposar) | Vista `loans_overdue` i filtres ràpids de la interfície |
| Bot "Avís d'estoc mínim" | Indicador al tauler i filtre "Cal reposar". Els avisos per correu poden ser una Edge Function |
| Accions (Iniciar ús, Finalitzar, Marcar retornat…) | `actions` a `src/resources.ts` |
| *(no existia)* | Estat automàtic de les màquines, control de solapaments, manteniment periòdic automàtic |

## Frontend

La interfície és **declarativa**. `src/resources.ts` descriu cada pantalla:

- taula de la base de dades;
- columnes de la llista;
- camps del formulari;
- accions;
- filtres;
- permisos de docent.

`ResourcePage` i `RecordForm` ho pinten tot. Afegir un camp o una pantalla rarament requereix tocar components.

### Afegir un camp

1. Crea una migració nova:

```sql
alter table public.machines add column serial_number text;
```

2. A `src/resources.ts`, afegeix el camp a `fields` de `maquines` (i, si cal, a `columns`):

```ts
{ name: 'serial_number', label: 'Número de sèrie', type: 'text' }
```

### Afegir un mòdul nou

1. Crea una migració que:
   - insereixi el mòdul a `public.modules`;
   - insereixi la fila corresponent a `school_modules` per a cada centre existent;
   - creï les taules amb `school_id` i `unique (id, school_id)`;
   - executi `select public._apply_domain_policies('taula', 'modul', docent_crea, docent_edita_el_seu);`.
2. Afegeix el mòdul a `create_school` si ha de quedar activat per defecte. Ara ja els activa tots.
3. Afegeix-ne les pantalles a `RESOURCES`. El menú es genera sol.

### Afegir una llista configurable

Insereix-la a `list_defs` i els valors per defecte a `list_defaults`. Per als centres que ja existeixen, executa `select public.seed_default_lists(id) from schools;`. Al formulari, fes servir `type: 'select', list: 'clau'`.

## Possibles millores

- Avisos per correu: estoc mínim, préstecs endarrerits, incidències urgents. Es pot fer amb Supabase Edge Functions + `pg_cron`.
- Vista de calendari per a les sessions.
- Exportació a CSV de cada pantalla.
- Historial per màquina: usos, incidències i manteniment en una sola fitxa.
- Codi QR enganxat a cada màquina que obri directament *Iniciar ús*.
- Importador de CSV des de l'app.
