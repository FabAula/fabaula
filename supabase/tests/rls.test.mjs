import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dir = process.argv[2];
const db = new PGlite();
const stubs = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
`;
await db.exec(stubs);
for (const f of fs.readdirSync(dir).sort()) {
  try { await db.exec(fs.readFileSync(dir + '/' + f, 'utf8')); console.log('OK', f); }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}
let pass = 0, fail = 0;
async function as(email) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ email })}', false);`);
  if (email) await db.exec('set role authenticated');
}
async function q(sql) { return (await db.query(sql)).rows; }
async function expectOk(name, fn) { try { const r = await fn(); console.log('  ✓', name, r !== undefined ? JSON.stringify(r) : ''); pass++; return r; } catch (e) { console.log('  ✗', name, e.message); fail++; } }
async function expectErr(name, sql, re) { try { await db.exec(sql); console.log('  ✗', name, '(no error)'); fail++; } catch (e) { if (!re || re.test(e.message)) { console.log('  ✓', name, '→', e.message); pass++; } else { console.log('  ✗', name, 'wrong error', e.message); fail++; } } }
function check(name, cond, info) { if (cond) { console.log('  ✓', name, info ?? ''); pass++; } else { console.log('  ✗', name, info ?? ''); fail++; } }

console.log('--- demo');
await as(null);
const demo = (await q(`select id from schools where slug='demo'`))[0].id;
const ms = await q(`select name, status from machines where school_id='${demo}' order by name`);
check('3D en ús, brodadora avaria', ms.find(m=>m.name==='Impressora 3D 1').status==='En ús' && ms.find(m=>m.name==='Brodadora').status==='Avaria', JSON.stringify(ms));
const mt = await q(`select task, status, planned_on::text from maintenance where school_id='${demo}' and task='Calibrar el llit' order by status`);
check('manteniment següent programat', mt.length===2 && mt.some(r=>r.status==='Programat'), JSON.stringify(mt));
const st = await q(`select full_name, current_stock::text, stock_status from consumables_stock where school_id='${demo}' order by full_name`);
check('estoc calculat', st.find(s=>s.full_name==='PLA - Verd').stock_status==='Sense estoc' && st.find(s=>s.full_name==='DM 3 mm - Natural').stock_status==='Cal reposar', JSON.stringify(st));
check('préstec endarrerit', (await q(`select count(*)::int c from loans_overdue where school_id='${demo}'`))[0].c===1);
const av = await q(`select name, available_qty from materials_availability where school_id='${demo}' and name like 'Kit%'`);
check('disponibilitat micro:bit = 6', av[0].available_qty===6, JSON.stringify(av));

console.log('--- plataforma');
await db.exec(`insert into platform_admins values ('pol@plat.cat')`);
await as('pol@plat.cat');
const sid = (await expectOk('crear centre', async () => (await q(`select create_school('Escola Test','test','Amaya@Escola.cat','Amaya') as id`))[0].id));
const sid2 = (await q(`select create_school('Altra Escola','altra','admin@altra.cat') as id`))[0].id;
check('plataforma no veu màquines del centre', (await q(`select count(*)::int c from machines where school_id='${sid}'`))[0].c===0);
check('plataforma veu membres', (await q(`select email from school_members where school_id='${sid}'`))[0]?.email==='amaya@escola.cat');
await as('random@gmail.com');
await expectErr('usuari qualsevol no crea centres', `select create_school('X','x','a@b.c')`, /plataforma/);
const rs = await q(`select slug, role from my_schools()`);
check('usuari qualsevol només veu demo', rs.length===1 && rs[0].slug==='demo', JSON.stringify(rs));
check('pot llegir màquines demo', (await q(`select count(*)::int c from machines where school_id='${demo}'`))[0].c===4);
await expectErr('no pot escriure a la demo', `insert into machines (school_id, name) values ('${demo}', 'hack')`, /row-level security/);
await expectErr('no pot reiniciar la demo', `select reset_demo()`, /No autoritzat/);

console.log('--- admin centre');
await as('amaya@escola.cat');
check('my_schools admin', (await q(`select role from my_schools() where slug='test'`))[0]?.role==='admin');
await expectOk('afegir docent', () => db.exec(`insert into school_members (school_id,email,full_name,role) values ('${sid}','Joan@Escola.cat','Joan','docent')`));
await expectOk('afegir gestor', () => db.exec(`insert into school_members (school_id,email,role) values ('${sid}','gestor@escola.cat','gestor')`));
await expectErr('no pot afegir membres a un altre centre', `insert into school_members (school_id,email) values ('${sid2}','x@y.z')`, /row-level security/);
await expectErr('no es pot treure l\'últim admin', `update school_members set role='docent' where school_id='${sid}' and email='amaya@escola.cat'`, /administrador/);
const mid = (await q(`insert into machines (school_id,name,created_by) values ('${sid}','Làser','fals@x.cat') returning id, created_by`))[0];
check('created_by forçat', mid.created_by==='amaya@escola.cat', JSON.stringify(mid));
const spc = (await q(`insert into spaces (school_id,name) values ('${sid}','Aula') returning id`))[0].id;
const mat = (await q(`insert into materials (school_id,name,total_qty) values ('${sid}','Bee-Bot',3) returning id`))[0].id;
check('llistes per defecte', (await q(`select count(*)::int c from list_items where school_id='${sid}'`))[0].c > 50);
await expectErr('referència a un altre centre', `insert into sessions (school_id, session_date, start_time, end_time, space_id) values ('${sid}', current_date, '09:00','10:00', (select id from spaces where school_id='${demo}' limit 1))`, /foreign key|violates/);

await expectErr('ús amb màquina d\'un altre centre (sense filtrar info)', `insert into machine_uses (school_id, machine_id) values ('${sid}', (select id from machines where school_id='${demo}' and name='Brodadora'))`, /foreign key/);
await expectErr('préstec amb material d\'un altre centre', `insert into loans (school_id, material_id) values ('${sid}', (select id from materials where school_id='${demo}' limit 1))`, /foreign key/);
console.log('--- docent');
await as('joan@escola.cat');
await expectErr('docent no crea màquines', `insert into machines (school_id,name) values ('${sid}','x')`, /row-level security/);
const use1 = await expectOk('docent inicia ús', async () => (await q(`insert into machine_uses (school_id, machine_id) values ('${sid}','${mid.id}') returning id`))[0].id);
check('màquina passa a En ús', (await q(`select status from machines where id='${mid.id}'`))[0].status==='En ús');
await expectErr('no es pot iniciar un segon ús', `insert into machine_uses (school_id, machine_id) values ('${sid}','${mid.id}')`, /ja està en ús/);
await expectOk('docent finalitza el seu ús', () => db.exec(`update machine_uses set end_time = start_time + interval '30 minutes', final_status='Correcte' where id='${use1}'`));
check('màquina torna a Operativa', (await q(`select status from machines where id='${mid.id}'`))[0].status==='Operativa');
await expectOk('sessió 9-10', () => db.exec(`insert into sessions (school_id, session_date, start_time, end_time, space_id) values ('${sid}', current_date, '09:00','10:00','${spc}')`));
await expectErr('sessió solapada', `insert into sessions (school_id, session_date, start_time, end_time, space_id) values ('${sid}', current_date, '09:30','10:30','${spc}')`, /ja està reservat/);
await expectOk('préstec 2 de 3', () => db.exec(`insert into loans (school_id, material_id, qty) values ('${sid}','${mat}',2)`));
await expectErr('préstec excessiu', `insert into loans (school_id, material_id, qty) values ('${sid}','${mat}',2)`, /disponibles/);
await expectOk('incidència urgent', () => db.exec(`insert into incidents (school_id, machine_id, description, priority) values ('${sid}','${mid.id}','Fum','Urgent')`));
check('màquina en Avaria', (await q(`select status from machines where id='${mid.id}'`))[0].status==='Avaria');
await expectErr('no es pot usar màquina avariada', `insert into machine_uses (school_id, machine_id) values ('${sid}','${mid.id}')`, /no es pot fer servir/);
const upd = await q(`update incidents set status='Resolta' where school_id='${sid}' returning id`);
check('docent no pot editar incidències', upd.length===0);
await expectErr('docent no pot gestionar membres', `insert into school_members (school_id,email) values ('${sid}','z@z.z')`, /row-level security/);
check('docent no veu l\'altre centre', (await q(`select count(*)::int c from schools where id='${sid2}'`))[0].c===0);
await expectOk('pujar foto al seu centre', () => db.exec(`insert into storage.objects (bucket_id,name) values ('media','${sid}/machines/a.jpg')`));
await expectErr('pujar foto a un altre centre', `insert into storage.objects (bucket_id,name) values ('media','${sid2}/machines/a.jpg')`, /row-level security/);
await expectErr('ruta invàlida', `insert into storage.objects (bucket_id,name) values ('media','hola/a.jpg')`, /row-level security/);
const dash = await q(`select dashboard('${sid}') d`);
check('dashboard', dash[0].d.open_incidents===1 && dash[0].d.loans_open===1, JSON.stringify(dash[0].d));

console.log('--- gestor + mòduls');
await as('gestor@escola.cat');
await expectOk('gestor resol incidència', () => db.exec(`update incidents set status='Resolta' where school_id='${sid}'`));
check('data resolució automàtica', (await q(`select resolved_on is not null r from incidents where school_id='${sid}'`))[0].r);
await expectOk('gestor posa màquina operativa', () => db.exec(`update machines set status='Operativa' where id='${mid.id}'`));
const cons = (await q(`insert into consumables (school_id, variant_name, min_stock) values ('${sid}','PLA',1) returning id`))[0].id;
await expectOk('entrada estoc', () => db.exec(`insert into consumable_movements (school_id, consumable_id, type, qty) values ('${sid}','${cons}','Entrada',3)`));
await expectErr('sortida > estoc', `insert into consumable_movements (school_id, consumable_id, type, qty) values ('${sid}','${cons}','Sortida',5)`, /prou estoc/);
console.log('--- usos: acabar un altre dia i consumibles');
await as('joan@escola.cat');
const u2 = (await q(`insert into machine_uses (school_id, machine_id, use_date, start_time) values ('${sid}','${mid.id}', local_today() - 1, '17:00') returning id`))[0].id;
await expectOk('finalitza l\'endemà (06:52) sense data de fi', () => db.exec(`update machine_uses set end_time='06:52', final_status='Correcte' where id='${u2}'`));
check('data de fi = avui', (await q(`select end_date = local_today() ok from machine_uses where id='${u2}'`))[0].ok);
check('màquina torna a Operativa', (await q(`select status from machines where id='${mid.id}'`))[0].status==='Operativa');
await expectErr('fi abans de l\'inici el mateix dia', `insert into machine_uses (school_id, machine_id, use_date, start_time, end_time, end_date) values ('${sid}','${mid.id}', local_today(), '10:00', '09:00', local_today())`, /anterior a l'inici/);
const u3 = (await q(`insert into machine_uses (school_id, machine_id, start_time) values ('${sid}','${mid.id}', '00:00') returning id`))[0].id;
await expectOk('finalitza amb 2 de PLA', () => db.exec(`update machine_uses set end_time='23:59', consumable_id='${cons}', consumable_qty=2 where id='${u3}'`));
const stock = async () => Number((await q(`select current_stock as stock from consumables_stock where id='${cons}'`))[0].stock);
check('estoc 3 → 1', (await stock()) === 1, String(await stock()));
await expectOk('corregeix a 1', () => db.exec(`update machine_uses set consumable_qty=1 where id='${u3}'`));
check('estoc torna a 2 (no duplica moviment)', (await stock()) === 2, String(await stock()));
await expectErr('massa consum', `update machine_uses set consumable_qty=5 where id='${u3}'`, /prou estoc/);
const mv = (await q(`select consumable_movement_id m from machine_uses where id='${u3}'`))[0].m;
await db.exec(`update machine_uses set consumable_movement_id=gen_random_uuid() where id='${u3}'`);
check('no es pot canviar l\'enllaç amb el moviment', (await q(`select consumable_movement_id m from machine_uses where id='${u3}'`))[0].m === mv);
await as('amaya@escola.cat');
await expectOk('admin esborra l\'ús', () => db.exec(`delete from machine_uses where id='${u3}'`));
check('el moviment s\'esborra i l\'estoc torna a 3', (await stock()) === 3, String(await stock()));
await as('gestor@escola.cat');
const r0 = await q(`update school_modules set enabled=false where school_id='${sid}' and module='prestecs' returning 1`);
check('gestor no pot desactivar mòduls (0 files)', r0.length===0);
await as('amaya@escola.cat');
await expectOk('admin desactiva préstecs', () => db.exec(`update school_modules set enabled=false where school_id='${sid}' and module='prestecs'`));
check('materials ja no visibles', (await q(`select count(*)::int c from materials where school_id='${sid}'`))[0].c===0);
await expectErr('no es pot inserir en mòdul desactivat', `insert into materials (school_id,name) values ('${sid}','x')`, /row-level security/);
await expectOk('manteniment realitzat', () => db.exec(`insert into maintenance (school_id, machine_id, task, periodicity, status) values ('${sid}','${mid.id}','Neteja lent','Setmanal','Realitzat')`));
check('següent manteniment creat', (await q(`select count(*)::int c from maintenance where school_id='${sid}' and status='Programat'`))[0].c===1);

console.log('--- identitat del centre');
await as('amaya@escola.cat');
await expectOk('admin canvia color', () => db.exec(`update schools set brand_color='#aa3366', name='Escola Test 2' where id='${sid}'`));
await expectErr('admin no canvia slug', `update schools set slug='hack' where id='${sid}'`, /plataforma/);
await expectErr('color invàlid', `update schools set brand_color='vermell' where id='${sid}'`, /check/);
check('my_schools retorna color', (await q(`select brand_color from my_schools() where id='${sid}'`))[0]?.brand_color==='#aa3366');
await as('joan@escola.cat');
check('docent no canvia color (0 files)', (await q(`update schools set brand_color='#000000' where id='${sid}' returning 1`)).length===0);
console.log('--- suggeriments');
await as('joan@escola.cat');
await expectOk('docent envia suggeriment', () => db.exec(`insert into feedback (school_id, kind, message, email) values ('${sid}', 'Millora', 'Estaria bé un mode fosc', 'fals@x.cat')`));
check('autor forçat', (await q(`select email from feedback`))[0]?.email === 'joan@escola.cat');
await expectErr('missatge massa curt', `insert into feedback (kind, message) values ('Queixa', 'hola')`, /check/);
await expectErr('duplicat', `insert into feedback (kind, message) values ('Millora', 'Estaria bé un mode fosc')`, /ja l'havies/);
for (let i = 0; i < 4; i++) await db.exec(`insert into feedback (kind, message) values ('Altres', 'Missatge de prova número ${i}')`);
await expectErr('límit diari', `insert into feedback (kind, message) values ('Altres', 'Un sisè missatge del dia')`, /molts missatges/);
await as('amaya@escola.cat');
check('altres no veuen suggeriments aliens', (await q(`select count(*)::int c from feedback`))[0].c === 0);
await as('pol@plat.cat');
check('plataforma els veu tots', (await q(`select count(*)::int c from feedback`))[0].c === 5);
await expectErr('anònim no pot', `reset role; select set_config('request.jwt.claims','{}',false); set role anon; insert into feedback (kind, message) values ('Altres', 'spam spam spam spam')`);
console.log('--- esborrar centre');
await as(null);
await expectOk('reset demo 2a vegada', () => db.exec(`select reset_demo()`));
await expectOk('esborrar centre en cascada', () => db.exec(`delete from schools where id='${sid}'`));
console.log(`\n${pass} ok, ${fail} errors`);
process.exit(fail ? 1 : 0);
