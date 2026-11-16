# FabAula

Aplicació web per gestionar aules maker i espais de fabricació digital a les escoles: màquines, usos, manteniment, incidències, préstec de material i consumibles. És **multi-centre**: cada escola té el seu administrador, que decideix quins mòduls activa i qui hi té accés.

Neix com a substitut d'una app d'AppSheet (FAIG CONTROL) que no es podia fer servir amb tot el claustre sense pagar llicències. L'anàlisi de l'app original és a [`docs/analisi-faig-control.md`](docs/analisi-faig-control.md).

## Què fa

| Mòdul | Pantalles | Detalls |
|---|---|---|
| Espais i sessions | Sessions, Espais | No deixa reservar el mateix espai dues vegades a la mateixa hora |
| Projectes | Projectes | Agrupen sessions, usos de màquines i consum de material |
| Màquines i usos | Màquines, Usos | Botons *Iniciar ús* / *Finalitzar*; l'estat de la màquina (Operativa ↔ En ús) es manté sol |
| Manteniment | Manteniment | En marcar una tasca com a feta, es programa automàticament la següent segons la periodicitat |
| Incidències | Incidències | Una incidència Alta/Urgent posa la màquina en *Avaria*; si un ús acaba amb "Incidència", se'n crea una automàticament |
| Préstec de material | Material, Préstecs | Controla les unitats disponibles; mostra els préstecs endarrerits |
| Consumibles i estoc | Consumibles, Moviments, Catàleg | Estoc calculat a partir d'entrades, sortides, pèrdues i ajustos; avisa quan cal reposar |

A més:

- **Targetes amb foto** per a màquines, material, consumibles i catàleg, amb l'estat i els botons a la mateixa targeta. Les taules queden per als historials.
- **Calendari** mensual, setmanal i en llista amb sessions, manteniment i retorns de préstecs. Tocant un forat lliure es reserva l'aula.
- **Inici** amb què passa ara a l'aula (màquines en ús, propera sessió) i el resum del dia.
- **Identitat de cada centre**: color i logotip propis, configurables per l'administrador.
- **Importador de fotos de l'AppSheet**: arrossegues les imatges i cada una va al seu registre.

- **Rols**: admin, gestor i docent, amb els permisos aplicats a la base de dades (RLS), no només a la interfície.
- **Mòduls activables** per centre.
- **Llistes configurables** per centre: grups, categories, unitats…
- **Escola de demostració** de només lectura, perquè qualsevol centre vegi com funciona cada mòdul abans d'activar-lo.
- **Alta massiva d'usuaris**: només cal enganxar la llista de correus del claustre.
- **Funciona al mòbil**: es pot instal·lar com a app (PWA) i fer fotos directament des del formulari.

## Tecnologia

- **Frontend**: React + Vite + TypeScript, desplegat a GitHub Pages.
- **Backend**: Supabase (Postgres, Auth amb Google o enllaç per correu, Storage per a les fotos).
- **Lògica i seguretat a la base de dades**: triggers, vistes i polítiques RLS. Tota la configuració és a `supabase/migrations/`.

## Estructura

```
supabase/
  migrations/        ← SQL versionat (font de veritat de la base de dades)
  all-in-one.sql     ← totes les migracions juntes, per enganxar a l'editor SQL
  tests/             ← tests de seguretat i lògica (PGlite, sense Docker)
src/
  resources.ts       ← definició declarativa de totes les pantalles i camps
  pages/             ← tauler, pantalla genèrica de dades, administració, plataforma
  components/        ← formulari genèric, UI
  lib/               ← client de Supabase, sessió, centre actual, fotos
docs/
  SETUP.md           ← posada en marxa pas a pas
  ARQUITECTURA.md    ← com està fet i com ampliar-ho
.github/workflows/   ← test + desplegament a Pages, keep-alive de Supabase
```

## Ordres

```bash
npm install
npm run dev          # servidor local (cal un .env, vegeu .env.example)
npm run test:db      # tests de la base de dades (RLS, triggers, demo)
npm run build        # build de producció
npm run sql:bundle   # regenera supabase/all-in-one.sql
```

## Posada en marxa

Segueix [`docs/SETUP.md`](docs/SETUP.md).
