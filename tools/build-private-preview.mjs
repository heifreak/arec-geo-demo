import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['src/local-preview.js'], bundle: true, format: 'iife', minify: true, legalComments: 'inline', write: false, target: 'es2022' });
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = await readFile('index.html','utf8');
html = html.replace('<html lang="es">','<html lang="es" data-local-preview="true">')
  .replace('<link rel="stylesheet" href="./src/styles.css">', `<style>${await readFile('src/styles.css','utf8')}</style>`)
  .replace(/<script type="module" src="\.\/src\/app\.js"><\/script>/, () => `<script>${script}</script>`);
if (html.includes('src="./src/app.js"')) throw Error('Preview was not bundled');
const license = await readFile('node_modules/acorn/LICENSE','utf8');
html = html.replace('<head>', () => `<head>\n<!-- Acorn parser · ${license.replaceAll('--', '—')} -->`);
await writeFile('preview.html',html);
console.log('preview.html generado: visor genérico, sin referencias ni datos privados.');
