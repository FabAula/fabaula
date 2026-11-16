-- =====================================================================
-- FabAula · 07 · Centre de demostració
-- Qualsevol usuari autenticat el pot consultar (només lectura) per veure
-- com funciona cada mòdul abans d'activar-lo al seu centre.
-- reset_demo() l'esborra i el torna a crear amb dates relatives a avui.
-- =====================================================================

create or replace function public.reset_demo()
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_school uuid;
  d date := public.local_today();
  sp_aula uuid; sp_taller uuid;
  pr_robot uuid; pr_llums uuid; pr_hort uuid;
  mq_3d uuid; mq_laser uuid; mq_vinil uuid; mq_brod uuid;
  mt_microbit uuid; mt_spike uuid; mt_beebot uuid; mt_eines uuid;
  ct_pla uuid; ct_dm uuid; ct_vinil uuid;
  cs_pla_blanc uuid; cs_pla_verd uuid; cs_dm3 uuid; cs_vinil_negre uuid;
  maint_id uuid;
begin
  -- Si la crida ve de l'API (hi ha JWT), només la pot fer un admin de plataforma.
  -- Sense JWT (editor SQL, pg_cron) sempre es permet.
  if current_email() <> '' and not is_platform_admin() then
    raise exception 'No autoritzat';
  end if;

  delete from schools where slug = 'demo';
  insert into schools (name, slug, is_demo) values ('Escola de demostració', 'demo', true)
  returning id into v_school;

  insert into school_modules (school_id, module, enabled) select v_school, key, true from modules;
  perform seed_default_lists(v_school);

  insert into school_members (school_id, email, full_name, role) values
    (v_school, 'direccio@demo.fabaula',  'Direcció (demo)',  'admin'),
    (v_school, 'coordinacio@demo.fabaula', 'Equip motor (demo)', 'gestor'),
    (v_school, 'mestra1@demo.fabaula',   'Mestra 5è (demo)', 'docent'),
    (v_school, 'mestra2@demo.fabaula',   'Mestre 6è (demo)', 'docent');

  -- Espais
  insert into spaces (school_id, name, location, capacity, equipment, rules, created_by)
  values (v_school, 'Aula Maker', 'Planta baixa', 26, 'Impressores 3D, làser, plòter de vinil, brodadora',
          'Ulleres de protecció obligatòries amb el làser. Deixar les màquines netes.', 'coordinacio@demo.fabaula')
  returning id into sp_aula;
  insert into spaces (school_id, name, location, capacity, created_by)
  values (v_school, 'Taller de tecnologia', 'Primera planta', 20, 'coordinacio@demo.fabaula')
  returning id into sp_taller;

  -- Projectes
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Robots que reciclen', 'Actiu', '5è', '5è A, 5è B', 'mestra1@demo.fabaula',
          d - 20, d + 40, 'Disseny d''un robot classificador de residus amb micro:bit', 'Prototip de robot', 'mestra1@demo.fabaula')
  returning id into pr_robot;
  insert into projects (school_id, name, status, course, groups, responsible_email, start_date, end_date, description, final_product, created_by)
  values (v_school, 'Llums de Nadal', 'En preparació', '6è', '6è A', 'mestra2@demo.fabaula',
          d + 5, d + 30, 'Decoració lluminosa tallada amb làser i circuits senzills', 'Fanalets de DM', 'mestra2@demo.fabaula')
  returning id into pr_llums;
  insert into projects (school_id, name, status, course, responsible_email, start_date, end_date, created_by)
  values (v_school, 'Hort intel·ligent', 'Finalitzat', '5è', 'mestra1@demo.fabaula', d - 120, d - 30, 'mestra1@demo.fabaula')
  returning id into pr_hort;

  -- Sessions
  insert into sessions (school_id, session_date, start_time, end_time, teacher_email, group_name, project_id, space_id, activity, status, created_by) values
    (v_school, d - 7, '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Muntatge del xassís', 'Realitzada', 'mestra1@demo.fabaula'),
    (v_school, d,     '09:00', '10:30', 'mestra1@demo.fabaula', '5è', pr_robot, sp_aula, 'Programació dels sensors', 'Programada', 'mestra1@demo.fabaula'),
    (v_school, d,     '11:00', '12:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_aula, 'Disseny dels fanalets a Inkscape', 'Programada', 'mestra2@demo.fabaula'),
    (v_school, d + 2, '15:00', '16:30', 'mestra2@demo.fabaula', '6è', pr_llums, sp_taller, 'Soldadura de LEDs', 'Programada', 'mestra2@demo.fabaula');

  -- Màquines
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Impressora 3D 1', 'Prusa MK4', 'Impressora 3D', 'Aula Maker', 'coordinacio@demo.fabaula', d - 400, d - 25, 'coordinacio@demo.fabaula')
  returning id into mq_3d;
  insert into machines (school_id, name, brand_model, category, location, responsible_email, acquired_on, last_review_on, created_by)
  values (v_school, 'Làser', 'xTool S1', 'Tall i gravat làser', 'Aula Maker', 'coordinacio@demo.fabaula', d - 300, d - 60, 'coordinacio@demo.fabaula')
  returning id into mq_laser;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Plòter de vinil', 'Cricut Maker 3', 'Tall de vinil', 'Aula Maker', d - 500, 'coordinacio@demo.fabaula')
  returning id into mq_vinil;
  insert into machines (school_id, name, brand_model, category, location, acquired_on, created_by)
  values (v_school, 'Brodadora', 'Brother Innov-is', 'Brodat', 'Taller de tecnologia', d - 200, 'coordinacio@demo.fabaula')
  returning id into mq_brod;

  -- Material de préstec
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Kit micro:bit v2', 'Robòtica', 12, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_microbit;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'LEGO Spike Prime', 'Robòtica', 6, 'Armari 2', 'coordinacio@demo.fabaula') returning id into mt_spike;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Bee-Bot', 'Robòtica', 8, 'Armari 1', 'coordinacio@demo.fabaula') returning id into mt_beebot;
  insert into materials (school_id, name, category, total_qty, location, created_by)
  values (v_school, 'Caixa d''eines', 'Eines manuals', 4, 'Taller', 'coordinacio@demo.fabaula') returning id into mt_eines;

  -- Usos de màquina (un d'obert → la impressora queda "En ús")
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, end_time, project_id, final_status, created_by) values
    (v_school, mq_laser, 'mestra2@demo.fabaula', d - 3, '11:00', '11:45', pr_llums, 'Correcte', 'mestra2@demo.fabaula'),
    (v_school, mq_3d,    'mestra1@demo.fabaula', d - 7, '09:15', '10:20', pr_robot, 'Correcte', 'mestra1@demo.fabaula');
  insert into machine_uses (school_id, machine_id, user_email, use_date, start_time, planned_end_time, project_id, created_by) values
    (v_school, mq_3d, 'mestra1@demo.fabaula', d, '09:05', '10:30', pr_robot, 'mestra1@demo.fabaula');

  -- Manteniment
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, created_by) values
    (v_school, mq_laser, 'Neteja', 'Netejar lent i miralls', d + 3, 'coordinacio@demo.fabaula', 'Mensual', 'Programat', 'coordinacio@demo.fabaula'),
    (v_school, mq_vinil, 'Preventiu', 'Canviar la fulla de tall', d - 2, 'coordinacio@demo.fabaula', 'Trimestral', 'Pendent', 'coordinacio@demo.fabaula');
  insert into maintenance (school_id, machine_id, type, task, planned_on, responsible_email, periodicity, status, action_description, created_by)
  values (v_school, mq_3d, 'Calibratge', 'Calibrar el llit', d - 25, 'coordinacio@demo.fabaula', 'Mensual', 'Pendent', 'Calibratge en 9 punts', 'coordinacio@demo.fabaula')
  returning id into maint_id;
  update maintenance set status = 'Realitzat', done_on = d - 25 where id = maint_id;  -- programa la següent automàticament

  -- Incidències (la urgent posa la brodadora en "Avaria")
  insert into incidents (school_id, inc_date, reporter_email, type, machine_id, description, priority, status, created_by) values
    (v_school, d - 1, 'mestra2@demo.fabaula', 'Màquina', mq_brod, 'L''agulla es trenca en començar a brodar', 'Urgent', 'Pendent', 'mestra2@demo.fabaula'),
    (v_school, d - 10, 'mestra1@demo.fabaula', 'Material', null, 'Falten 2 cables USB al kit micro:bit', 'Baixa', 'Resolta', 'mestra1@demo.fabaula');
  update incidents set material_id = mt_microbit, resolution = 'Comprats cables nous', resolved_on = d - 8
  where school_id = v_school and type = 'Material';

  -- Préstecs (un d'endarrerit)
  insert into loans (school_id, material_id, borrower_email, out_date, qty, due_date, status, created_by) values
    (v_school, mt_microbit, 'mestra1@demo.fabaula', d - 5, 6, d + 10, 'Prestat', 'mestra1@demo.fabaula'),
    (v_school, mt_beebot,   'mestra2@demo.fabaula', d - 15, 4, d - 2, 'Prestat', 'mestra2@demo.fabaula'),
    (v_school, mt_spike,    'mestra2@demo.fabaula', d - 30, 2, d - 20, 'Retornat', 'mestra2@demo.fabaula');

  -- Catàleg i consumibles
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Filament PLA 1,75 mm', 'Impressió 3D', 'Peces i prototips', 'Impressora 3D', 'coordinacio@demo.fabaula') returning id into ct_pla;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Tauler DM', 'Fusta i derivats', 'Tall i gravat', 'Làser', 'coordinacio@demo.fabaula') returning id into ct_dm;
  insert into catalog_items (school_id, name, category, uses, compatibility, created_by)
  values (v_school, 'Vinil adhesiu', 'Vinils', 'Retolació i adhesius', 'Plòter de vinil', 'coordinacio@demo.fabaula') returning id into ct_vinil;

  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Blanc', 'Bobina', 'Bobines', 2, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_blanc;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_pla, 'PLA', 'Verd', 'Bobina', 'Bobines', 1, 'Prestatge A', 'coordinacio@demo.fabaula') returning id into cs_pla_verd;
  insert into consumables (school_id, catalog_id, variant_name, color, thickness_mm, width_mm, length_mm, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_dm, 'DM 3 mm', 'Natural', 3, 400, 300, 'Planxa', 'Planxes', 10, 'Calaix làser', 'coordinacio@demo.fabaula') returning id into cs_dm3;
  insert into consumables (school_id, catalog_id, variant_name, color, format, stock_unit, min_stock, location, created_by)
  values (v_school, ct_vinil, 'Vinil mat', 'Negre', 'Rotlle', 'Metres', 2, 'Calaix vinil', 'coordinacio@demo.fabaula') returning id into cs_vinil_negre;

  insert into consumable_movements (school_id, consumable_id, type, mov_date, qty, user_email, project_id, supplier, total_price, created_by) values
    (v_school, cs_pla_blanc,   'Entrada', d - 60, 5,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 99.75, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_blanc,   'Sortida', d - 7,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_pla_verd,    'Entrada', d - 60, 1,  'coordinacio@demo.fabaula', null, 'Proveïdor 3D', 19.95, 'coordinacio@demo.fabaula'),
    (v_school, cs_pla_verd,    'Sortida', d - 3,  1,  'mestra1@demo.fabaula', pr_robot, null, null, 'mestra1@demo.fabaula'),
    (v_school, cs_dm3,         'Entrada', d - 40, 25, 'coordinacio@demo.fabaula', null, 'Fusteria del barri', 45.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_dm3,         'Sortida', d - 3,  17, 'mestra2@demo.fabaula', pr_llums, null, null, 'mestra2@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Entrada', d - 90, 10, 'coordinacio@demo.fabaula', null, 'Papereria', 30.00, 'coordinacio@demo.fabaula'),
    (v_school, cs_vinil_negre, 'Sortida', d - 20, 3,  'mestra2@demo.fabaula', null, null, null, 'mestra2@demo.fabaula');

  return v_school;
end $$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;  -- la funció comprova internament que siguis admin de plataforma

-- Crea la demo ara mateix
select public.reset_demo();
