// Ajunta totes les migracions en un sol fitxer per enganxar-lo a l'editor SQL de Supabase
import fs from 'fs';
const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const out = [
  '-- =====================================================================',
  '-- FabAula · TOTES LES MIGRACIONS EN UN SOL FITXER',
  '-- Generat amb `npm run sql:bundle`. No l\'editis a mà: edita supabase/migrations/.',
  '-- Executa-ho UNA SOLA VEGADA en un projecte de Supabase buit.',
  '-- =====================================================================',
  '',
  ...files.map((f) => `-- >>> ${f}\n${fs.readFileSync(`${dir}/${f}`, 'utf8').trim()}\n`),
].join('\n');
fs.writeFileSync('supabase/all-in-one.sql', out);
console.log(`supabase/all-in-one.sql (${files.length} migracions)`);
