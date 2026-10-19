import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const worker=await build({entryPoints:['src/folder-worker.js'],bundle:true,format:'iife',minify:true,legalComments:'inline',write:false,target:'es2022'});
const result=await build({entryPoints:['src/browser-entry.js'],bundle:true,format:'iife',minify:true,legalComments:'inline',write:false,target:'es2022',define:{__FOLDER_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text)}});
const notices=[await readFile('node_modules/acorn/LICENSE','utf8'),await readFile('licenses/streamparser-json-LICENSE','utf8')];
const bundle='/* '+notices.join('\n\n').replaceAll('*/','* /')+' */\n'+result.outputFiles[0].text;
await writeFile('src/viewer.bundle.js',bundle);
const script=bundle.replace(/<\/script/gi,'<\\/script');
let html=await readFile('index.html','utf8');
html=html.replace('<html lang="es">','<html lang="es" data-local-preview="true">')
  .replace('<link rel="stylesheet" href="./src/styles.css">',`<style>${await readFile('src/styles.css','utf8')}</style>`)
  .replace(/<script type="module" src="\.\/src\/viewer\.bundle\.js"><\/script>/,()=>`<script>${script}</script>`);
if(html.includes('src="./src/viewer.bundle.js"'))throw Error('Preview was not bundled');
html=html.replace('<head>',()=>`<head>\n<!-- Third-party licenses\n${notices.join('\n\n').replaceAll('--','—')} -->`);
await writeFile('preview.html',html);
console.log('Visor web y HTML descargable generados con worker local. Sin referencias ni datos corporativos.');
