import { readdir, lstat, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, sep, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLAZAS } from '../src/plazas.js';

/** Local inventory, not a classification or public-release approval. No property values exported. */
export async function inventory(root, { maxBytes = 64 * 1024 * 1024 } = {}) {
  const base = await realpath(root);
  const records = [];
  async function walk(directory) {
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, child.name); const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Inventario incompleto: no se siguen enlaces simbólicos.');
      if (stat.isDirectory()) { await walk(path); continue; }
      if (!/\.(geojson|json)$/i.test(child.name)) continue;
      const parts = relative(base, path).split(sep);
      // Filename tokens are hints only; never invent sublayer semantics.
      const tokens = parts.join('/').toUpperCase().split(/[^A-Z0-9]+/);
      const variables = [...new Set(tokens.filter(value => /^V(0[1-9]|1[0-9]|2[0-3])$/.test(value)))];
      const plazas = [...new Set(tokens.filter(value => Object.hasOwn(PLAZAS, value)))];
      const item = { file: parts.join('/'), bytes: stat.size, candidateVariables: variables, candidatePlazas: plazas, internalCandidate: variables.some(value => /^V1[5-8]$/.test(value)), publicApproved: false };
      if (stat.size > maxBytes) { item.status = 'too-large-to-inspect'; records.push(item); continue; }
      try {
        const json = JSON.parse(await readFile(path, 'utf8'));
        const features = json.type === 'FeatureCollection' ? json.features : json.type === 'Feature' ? [json] : null;
        if (!Array.isArray(features)) { item.status = 'json-not-feature-collection'; item.topLevelFields = Object.keys(json ?? {}); }
        else {
          const fields = new Set(); const geometryTypes = new Set(); let nullGeometry = 0;
          for (const feature of features) {
            if (feature?.type !== 'Feature') throw Error('Invalid feature');
            for (const key of Object.keys(feature.properties ?? {})) fields.add(key);
            if (feature.geometry) geometryTypes.add(feature.geometry.type); else nullGeometry++;
          }
          item.status = 'inspected-not-validated'; item.features = features.length;
          item.fields = [...fields].sort(); item.geometryTypes = [...geometryTypes].sort(); item.nullGeometry = nullGeometry;
        }
      } catch { item.status = 'invalid-json-or-features'; }
      records.push(item);
    }
  }
  await walk(base);
  return { version: 1, purpose: 'Inventario local sin aprobación de publicación. No valida geometrías ni reproduce cálculos.', files: records };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error('Uso: node tools/inventory.mjs DIRECTORIO_DATOS SALIDA_PRIVADA.json'); process.exitCode = 1; }
  else {
    const checkout = await realpath(resolve(import.meta.dirname, '..')); const requested = resolve(output);
    const out = resolve(await realpath(dirname(requested)), basename(requested));
    if (out === checkout || out.startsWith(checkout + sep)) throw Error('El inventario debe guardarse fuera del checkout público.');
    const result = await inventory(input); await writeFile(out, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(`Inventario privado creado: ${result.files.length} archivos. No se cargaron ni publicaron datos.`);
  }
}
