import {WINDOW_BYTES} from './point-window.js';
import {baseTemplate} from './base-layers.js';
import {buildFolderCatalog} from './folder-catalog.js';
import {folderAPI} from './app.js';
import {workerJob} from './folder-client.js';
import {compileReferenceHTML,matchReferencePath,descriptorForInventory} from './reference-html.js';
import {saveFolderSnapshot,restoreFolderSnapshot,deleteFolderSnapshot} from './folder-storage.js';
import {PLAZAS} from './plazas.js';
const $=id=>document.getElementById(id);
const panel=document.createElement('details');panel.open=true;
panel.innerHTML=`<summary>Carpeta AREC GEO · importación masiva privada</summary>
<p>Elige la carpeta data una vez. Se inventaría por archivos y las capas solo se dibujan al activarlas. Nada se sube a servidores.</p>
<label>Carpeta raíz data<input id="folder-input" type="file" webkitdirectory multiple></label>
<label>Referencia V15/V14 local, solo si no está en la carpeta<input id="folder-reference" type="file" accept=".html,.htm"></label>
<label>Color técnico de capas BASE (no simbología V15)<input id="folder-base-color" type="color" value="#58b3cc"></label><p id="folder-reference-status">Definiciones privadas: pendientes. No se inventan estilos.</p>
<progress id="folder-progress" max="1" value="0"></progress><p id="folder-status" role="status">Sin carpeta seleccionada.</p>
<button id="folder-cancel" type="button">Cancelar operación</button><button id="folder-clear" type="button">Retirar carpeta y capas</button>
<p id="folder-limits">Inventario en worker, un archivo a la vez. Máximo por archivo: inventario 128 MiB; dibujo completo 25 MiB / 50 000 entidades; Point grandes por vista: 5 000 entidades / 8 MiB, hasta 128 MiB de origen, dos capas progresivas. Hasta 6 capas y 64 MiB de archivos activos; consumo real de Cesium puede ser mayor.</p>
<div id="folder-plazas"></div>
<details open><summary>Catálogo operativo · plaza y ámbito actuales</summary><p id="folder-catalog-status"></p><div id="folder-catalog"></div></details>
<details><summary>Diagnóstico global · 18 plazas</summary><p id="folder-global-status" role="status"></p><p>Disponibilidad, visualización y certificación son estados independientes. Los conteos de entidades por archivo no son celdas únicas.</p><p id="folder-comparison-status"></p><div id="folder-coverage"></div><button id="folder-validate" type="button">Repetir validación por lotes</button><button id="folder-report" type="button">Descargar informe técnico privado</button><p id="folder-report-status"></p></details>
<label>Inventario<select id="folder-filter"><option value="context">Plaza y ámbito actuales</option><option value="all">Todos los archivos</option><option value="issues">Errores, desconocidos y excluidos</option></select></label>
<label>Buscar archivo o variable<input id="folder-search" type="search" placeholder="V13, V14, NDVI, nombre…"></label><p id="folder-count"></p><div id="folder-rows"></div><button id="folder-prev">Anterior</button><button id="folder-next">Siguiente</button>
<details><summary>Copia local opcional</summary><p>Guarda en IndexedDB el inventario, las definiciones privadas y los archivos activables reconocidos. No copia internos ni desconocidos. Ocupa espacio de este navegador y origen; puede ser eliminado por el navegador. No es una copia en la nube ni una bóveda cifrada.</p>
<label class="check"><input id="folder-save-consent" type="checkbox">Autorizo guardar esta copia privada en este navegador</label>
<button id="folder-save">Guardar copia local</button><button id="folder-restore">Restaurar copia local</button><button id="folder-delete">Borrar copia local guardada</button><p id="folder-storage-status" role="status">Sin escritura de datos privados en almacenamiento local.</p></details>`;
document.querySelector('.left-panel').prepend(panel);
let entries=[],reference=null,scanController=null,operation=null,page=0,scanning=false,referenceGeneration=0,totalFiles=0,inventoryComplete=false,folderGeneration=0;
const visualChecks=new Map(),styleChecks=new Map(),fingerprints=new Map();let validationController=null;let globalReport=null;
const progressiveWanted=new Set(),reloadingPaths=new Set(),windowKeys=new Map();
const windowKey=bounds=>JSON.stringify(bounds.map(n=>Math.round(n*1e5)));let viewTimer=null;
const files=new Map(),active=new Map(),pending=new Map();let timer=null;
const refresh=()=>{if(!timer)timer=setTimeout(()=>{timer=null;render();},100);};
const bindings=new Map();
const matches=e=>{if(!bindings.has(e.path))bindings.set(e.path,e.base?[baseTemplate(e,{color:$('folder-base-color').value})].filter(Boolean):matchReferencePath(e.path,e,reference));return bindings.get(e.path);};
const mib=bytes=>(bytes/1024/1024).toFixed(1)+' MiB';
function render(){
  const context=folderAPI.context();
  globalReport=buildFolderCatalog(entries,reference,{complete:inventoryComplete,totalFiles,match:matches,runtime:visualChecks,styleChecks,fingerprints,requireStyleValidation:true});
  renderCatalog(context);renderCoverage();
  const counts=new Map(Object.keys(PLAZAS).map(code=>[code,{files:0,variables:new Set()}]));
  for(const e of entries){const c=counts.get(e.plaza);if(c){c.files++;const templates=matches(e);const variable=e.variable??(templates.length===1?templates[0].variable:null);if(variable&&e.status!=='internal-excluded')c.variables.add(variable);}}
  const local=entries.filter(e=>e.plaza===context.plaza&&e.scope===context.scope);
  const report=entries.length?[
    ['Inventario privado · archivos en este ámbito',local.length],
    ['Inventario privado · capas geográficas estructuralmente compatibles',local.filter(e=>e.kind==='geojson'&&e.renderable&&e.status!=='internal-excluded').length],
    ['Inventario privado · análisis territorial certificado','No certificado por el importador; atributos precalculados conservados']
  ]:[];
  for(const entry of local){
    const candidates=matches(entry);if(candidates.length!==1)continue;
    const expression=candidates[0].paint?.['fill-color'];
    const classField=Array.isArray(expression)&&expression[0]==='match'&&expression[1]?.[0]==='get'?expression[1][1]:null;
    const stats=classField&&entry.fields?.[classField];
    if(stats?.categoryCounts){
      for(const [value,count]of stats.categoryCounts)report.push([`Inventario · ${entry.path.split('/').at(-1)} · clase original ${value}`,count]);
      report.push([`Inventario · ${entry.path.split('/').at(-1)} · clase nula / ausente`,`${stats.nulls} / ${stats.missing}`]);
    }
  }
  folderAPI.setInventoryRows(report);
  const root=$('folder-plazas');root.replaceChildren();
  for(const [code,count]of counts){const button=document.createElement('button');button.type='button';button.textContent=`${code}: ${count.files} archivos · ${count.variables.size} variables en rutas`;button.addEventListener('click',()=>{$('plaza').value=code;$('plaza').dispatchEvent(new Event('change'));});root.append(button);}
  const filter=$('folder-filter').value;const query=$('folder-search').value.trim().toLowerCase();const list=entries.filter(e=>(!query||`${e.path} ${matches(e).map(t=>t.name+' '+t.variable+' '+t.variableName).join(' ')}`.toLowerCase().includes(query))&&(filter==='all'||filter==='context'&&e.plaza===context.plaza&&e.scope===context.scope||filter==='issues'&&(e.kind==='error'||e.status!=='recognized'||!e.renderable)));
  page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(list.length/40)-1)));
  $('folder-count').textContent=`${entries.length} archivos inventariados${!inventoryComplete?' (parcial)':''} · ${list.length} en filtro · página ${page+1} / ${Math.max(1,Math.ceil(list.length/40))}. Disponibilidad no equivale a análisis validado.`;
  const rows=$('folder-rows');rows.replaceChildren();
  for(const entry of list.slice(page*40,(page+1)*40)){
    const item=document.createElement('details');item.dataset.folderPath=entry.path;const title=document.createElement('summary');title.textContent=`${entry.variable??'Sin variable'} · ${entry.path.split('/').at(-1)} · ${entry.count??'—'} entidades · ${mib(entry.size)}`;item.append(title);
    const info=document.createElement('p');info.textContent=`${entry.path}\n${entry.status} · ${entry.kind??''} · ${entry.reason??''}`;item.append(info);
    const templates=matches(entry);const template=templates.length===1?templates[0]:null;
    const label=document.createElement('p');label.textContent=template?`${template.variableName} · ${template.name}${template.unsupported?' · simbología pendiente: '+template.unsupported:''}${template.visualWarning?' · '+template.visualWarning:''}`:reference?'Sin correspondencia única con las definiciones; no se activa.':'Pendiente de referencia privada; inventario disponible.';item.append(label);
    const isContext=entry.plaza===context.plaza&&entry.scope===context.scope;
    const button=document.createElement('button');button.type='button';button.dataset.folderAction=entry.path;
    button.textContent=pending.has(entry.path)?'Cancelar carga':active.has(entry.path)?'Descargar capa de memoria':'Activar capa';
    button.disabled=scanning||(!active.has(entry.path)&&!pending.has(entry.path)&&(!isContext||!globalReport.layers.find(layer=>layer.path===entry.path)?.activatable||!files.has(entry.path)));
    button.addEventListener('click',()=>toggle(entry));item.append(button);
    const schema=document.createElement('pre');schema.textContent=JSON.stringify({campos:entry.fields??entry.rootFields??'No leídos',geometrias:entry.geometries??'No aplicable',crs:entry.crs??'No declarado'},null,2);item.append(schema);rows.append(item);
  }
  $('folder-prev').disabled=page===0;$('folder-next').disabled=(page+1)*40>=list.length;
}
function renderCatalog(context){
  const root=$('folder-catalog');root.replaceChildren();
  const layers=globalReport.layers.filter(e=>e.plaza===context.plaza&&e.scope===context.scope&&!e.excluded&&e.kind==='geojson');
  $('folder-catalog-status').textContent=`${context.plaza} · ${context.scope}: ${layers.filter(e=>e.activatable).length} archivos activables / ${layers.length} geográficos. ${reference?'Vinculación automática con referencia local.':'Elige la referencia local una vez para vincular todas las plazas.'}`;
  const groups=new Map();
  for(const layer of layers){const key=layer.variable??'Sin variable';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(layer);}
  for(const v of reference?.structure??[])if(!v.excluded&&!groups.has(v.id))groups.set(v.id,[]);
  for(const [variable,group]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
    const section=document.createElement('details');section.open=true;const title=document.createElement('summary');title.textContent=`${variable} · ${group[0]?.variableName??reference?.structure?.find(v=>v.id===variable)?.name??'Definición pendiente'} · ${group.length} archivos`;section.append(title);
    for(const layer of group){
      const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.dataset.catalogPath=layer.path;check.checked=active.has(layer.path)||pending.has(layer.path);check.disabled=scanning||!layer.activatable||!files.has(layer.path);
      check.addEventListener('change',()=>toggle(entries.find(e=>e.path===layer.path)));
      const name=document.createElement('span');name.textContent=`${layer.name??layer.path.split('/').at(-1)} · ${layer.entities??'—'} entidades${pending.has(layer.path)?' · cargando':''}`;label.append(check,name);section.append(label);
      const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Origen, leyenda y validación';detail.append(summary);const text=document.createElement('p');const template=matches(entries.find(e=>e.path===layer.path));text.textContent=[layer.path,...layer.issues,`Visualización: ${layer.visualization.status}; validación técnica de estilo: ${layer.styleValidation.status}. Análisis: no certificado.`,...(template.length===1?(template[0].meta?.legend??[]).map(pair=>pair[1]):[])].join(' · ');detail.append(text);section.append(detail);
    }
    const present=new Set(group.map(e=>e.logicalId));for(const t of reference?.templates.filter(t=>t.variable===variable&&!present.has(t.logicalId))??[]){const missing=document.createElement('p');missing.textContent=t.name+' · sin archivo vinculado en este ámbito';section.append(missing);}
    root.append(section);
  }
}
function renderCoverage(){
  const r=globalReport,t=r.totals;
  $('folder-global-status').textContent=`${r.inventory.complete?'Inventario completo':'Inventario parcial'}: ${t.files}/${r.inventory.totalFiles} archivos · ${t.activatableFiles} activables · ${t.baseActivatable} BASE activables · ${t.largeFilesEnabled} grandes por vista · ${t.excluded} internos excluidos · ${t.errors} errores de lectura · ${t.ambiguous} ambiguos · ${t.unmatched} sin correspondencia · ${t.styleValidationFailed} fallos de simbología · ${t.withoutContext} sin plaza/ámbito.`;
  const comparison=r.comparison;$('folder-comparison-status').textContent=`Comparativo reproducible sobre el mismo inventario: ${comparison.baseline.activatableFiles} activables con el cargador anterior → ${comparison.after.activatableFiles} ahora (${comparison.activatableDelta>=0?'+':''}${comparison.activatableDelta}). No sustituye un diagnóstico histórico ni una validación visual.`;
  const root=$('folder-coverage');root.replaceChildren();
  for(const row of r.contexts){
    const detail=document.createElement('details');detail.dataset.coveragePlaza=row.plaza;detail.dataset.coverageScope=row.scope;
    const title=document.createElement('summary');title.textContent=`${row.plaza} · ${row.scope==='city'?'Ciudad':'Metrópoli'}: ${row.files} archivos · ${row.activatableFiles} activables · ${row.variables.length} variables en inventario · ${row.availableSublayers.length} subcapas`;detail.append(title);
    const pre=document.createElement('pre');pre.textContent=JSON.stringify(row,null,2);detail.append(pre);root.append(detail);
  }
  $('folder-report').disabled=!entries.length;$('folder-validate').disabled=scanning||(!reference&&!entries.some(e=>e.base));
}
$('folder-validate').onclick=()=>{if(!scanning)validateCatalog();};
$('folder-report').onclick=()=>{
  const blob=new Blob([JSON.stringify(globalReport,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='AREC-GEO-diagnostico-privado.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('folder-report-status').textContent='Informe privado descargado localmente. Contiene nombres, rutas y esquema; no publicarlo sin autorización.';
};
async function validateCatalog(){
  validationController?.abort();
  if(!reference&&!entries.some(e=>e.base))return;
  const controller=new AbortController();validationController=controller;
  const candidates=globalReport.layers.filter(e=>e.candidate&&files.has(e.path)&&styleChecks.get(e.path)?.status!=='passed');
  $('folder-report-status').textContent=`Validación técnica por lotes: 0/${candidates.length} capas. No certifica resultados territoriales.`;
  try{
    await workerJob({mode:'validate-styles',files:candidates.map(layer=>({path:layer.path,file:files.get(layer.path),paint:matches(entries.find(e=>e.path===layer.path))[0].paint}))},{signal:controller.signal,onMessage:message=>{
      if(validationController!==controller)return;
      if(message.kind==='style-bytes')$('folder-report-status').textContent=`Comprobando atributos y pintura ${message.completed+1}/${message.total}: ${mib(message.bytes)} / ${mib(message.size)} · ${message.path}`;
      if(message.kind==='style-validation'){styleChecks.set(message.path,message.validation);$('folder-report-status').textContent=`Validación técnica por lotes: ${message.completed}/${message.total} capas. Sin dibujar geometrías.`;refresh();}
    }});
    const groups=new Set(entries.filter(e=>e.variable==='V14'&&e.kind==='geojson'&&matches(e).length===0).map(e=>e.plaza+':'+e.scope));
    const compare=entries.filter(e=>e.variable==='V14'&&e.kind==='geojson'&&groups.has(e.plaza+':'+e.scope)&&files.has(e.path)&&e.size<=25*1024*1024&&!fingerprints.has(e.path));
    if(compare.length)await workerJob({mode:'fingerprints',files:compare.map(e=>({path:e.path,file:files.get(e.path)}))},{signal:controller.signal,onMessage:message=>{if(validationController===controller&&message.kind==='fingerprint'){fingerprints.set(message.path,message.fingerprint);$('folder-report-status').textContent=`Contraste binario privado V14: ${message.completed}/${message.total}. No decide equivalencia semántica.`;}}});
    if(validationController===controller)$('folder-report-status').textContent=`Validación técnica por lotes terminada: ${styleChecks.size} archivos comprobados. Informe global disponible; visualización y resultados territoriales requieren su propia validación.`;
  }catch(error){if(validationController===controller)$('folder-report-status').textContent=controller.signal.aborted?'Validación por lotes cancelada; las capas no comprobadas quedan pendientes.':`Validación por lotes interrumpida: ${error.message}`;}
  finally{if(validationController===controller){validationController=null;render();}}
}
function stopLoads(){progressiveWanted.clear();windowKeys.clear();clearTimeout(viewTimer);for(const controller of pending.values())controller.abort();pending.clear();for(const id of active.values())folderAPI.remove(id);active.clear();}
async function setReference(file){
  if(!file||file.size>2*1024*1024)throw Error('Referencia limitada a 2 MiB.');
  const generation=++referenceGeneration;const compiled=await compileReferenceHTML(await file.text());
  if(generation!==referenceGeneration)return;
  stopLoads();visualChecks.clear();styleChecks.clear();reference=compiled;bindings.clear();$('folder-reference-status').textContent=`Referencia privada vinculada: ${reference.templates.length} subcapas; ${reference.templates.filter(t=>t.paint).length} con estilo soportado; ${reference.templates.filter(t=>t.paths.length).length} con rutas originales. Internas excluidas.`;render();if(!scanning)await validateCatalog();
}
async function toggle(entry,{refreshWindow=false}={}){
  let previousOpacity=1;
  if(refreshWindow){
    pending.get(entry.path)?.abort();pending.delete(entry.path);
    if(active.has(entry.path)){previousOpacity=folderAPI.opacity(active.get(entry.path));reloadingPaths.add(entry.path);folderAPI.remove(active.get(entry.path));reloadingPaths.delete(entry.path);active.delete(entry.path);}
  }
  if(pending.has(entry.path)){progressiveWanted.delete(entry.path);pending.get(entry.path).abort();return;}
  if(active.has(entry.path)){progressiveWanted.delete(entry.path);folderAPI.remove(active.get(entry.path));active.delete(entry.path);render();return;}
  const context=folderAPI.context();if(entry.plaza!==context.plaza||entry.scope!==context.scope)return;
  const reserved=[...active.keys(),...pending.keys()].map(path=>entries.find(e=>e.path===path));
  if(reserved.length>=6||reserved.reduce((sum,e)=>sum+(e?.progressiveEligible?WINDOW_BYTES:e?.size??0),0)+(entry.progressiveEligible?WINDOW_BYTES:entry.size)>64*1024*1024){$('folder-status').textContent='Límite de capas/memoria alcanzado. Descarga una capa antes de activar otra.';return;}
  const templates=matches(entry);if(templates.length!==1||!globalReport.layers.find(layer=>layer.path===entry.path)?.activatable)return;
  if(entry.progressiveEligible){if(!progressiveWanted.has(entry.path)&&progressiveWanted.size>=2){$('folder-status').textContent='Máximo dos capas grandes progresivas; descarga una antes de continuar.';return;}progressiveWanted.add(entry.path);}
  const controller=new AbortController();pending.set(entry.path,controller);$('folder-status').textContent=`Iniciando lectura local: ${entry.path}`;render();
  try{
    const bounds=entry.progressiveEligible?folderAPI.viewBounds():null;if(bounds)windowKeys.set(entry.path,windowKey(bounds));
    const result=await workerJob(entry.progressiveEligible?{mode:'window',path:entry.path,file:files.get(entry.path),bounds}:{mode:'read',file:files.get(entry.path)},{signal:controller.signal,onMessage:message=>{if(message.kind==='bytes')$('folder-status').textContent=`Leyendo ${entry.path}: ${mib(message.bytes)} / ${mib(entry.size)}`;}});
    controller.signal.throwIfAborted();$('folder-status').textContent='Preparando capa 3D. Puedes cancelar; las conversiones ya iniciadas se descartarán al terminar.';
    const descriptor=descriptorForInventory(templates[0],result.data,entry);if(result.window)descriptor.warnings.push(`Representación parcial por vista: ${result.window.selected} de ${result.window.matched} puntos en ventana; ${result.window.sourceFeatures} entidades en el original. No usar la ventana como total territorial.`);
    const id=await folderAPI.activate(result.data,descriptor,controller.signal);controller.signal.throwIfAborted();active.set(entry.path,id);if(refreshWindow)folderAPI.setOpacity(id,previousOpacity);visualChecks.set(entry.path,{status:'rendered',representedEntities:result.data.features.length,checkedAt:new Date().toISOString(),...(result.window?{window:result.window}:{} )});
    if(result.window)window.dispatchEvent(new CustomEvent('arec-window-ready',{detail:{path:entry.path,...result.window}}));
    $('folder-status').textContent=`Capa activa: ${entry.path}. Atributos originales; cálculo y cobertura no certificados.${result.window?' Ventana: '+result.window.selected+' / '+result.window.matched+' puntos en vista'+(result.window.truncated?' · límite alcanzado, acerca la cámara.':'.'):''}`;
  }catch(error){if(!controller.signal.aborted){progressiveWanted.delete(entry.path);visualChecks.set(entry.path,{status:'error',reason:error.message,checkedAt:new Date().toISOString()});}$('folder-status').textContent=controller.signal.aborted?'Carga cancelada; resultados tardíos descartados.':`No se activó: ${error.message}`;}
  finally{if(pending.get(entry.path)===controller)pending.delete(entry.path);render();}
}
function clearFolder(){folderGeneration++;scanController?.abort();scanController=null;operation?.abort();scanning=false;referenceGeneration++;stopLoads();validationController?.abort();validationController=null;visualChecks.clear();styleChecks.clear();fingerprints.clear();entries=[];files.clear();reference=null;bindings.clear();page=0;totalFiles=0;inventoryComplete=false;$('folder-input').value='';$('folder-reference').value='';$('folder-save-consent').checked=false;$('folder-reference-status').textContent='Definiciones privadas: pendientes.';$('folder-progress').value=0;render();}
$('folder-input').addEventListener('change',async()=>{
  const selected=[...$('folder-input').files];const previousReference=reference;clearFolder();reference=previousReference;if(reference)$('folder-reference-status').textContent='Referencia local conservada; vinculación automática para todas las plazas.';if(!selected.length)return;
  const unique=new Set();const items=[];
  for(const file of selected){const path=file.webkitRelativePath||file.name;if(unique.has(path)){entries.push({path,size:file.size,status:'duplicate-path',reason:'Ruta duplicada; no se lee.'});continue;}unique.add(path);files.set(path,file);items.push({path,file});}
  const controller=new AbortController();scanController=controller;scanning=true;totalFiles=selected.length;inventoryComplete=false;let visitedBytes=0;
  $('folder-progress').max=items.length;$('folder-status').textContent=`Inventariando ${items.length} archivos locales…`;
  try{
    await workerJob({mode:'scan',files:items},{signal:controller.signal,onMessage:message=>{
      if(scanController!==controller)return;
      if(message.kind==='entry'){entries.push(message.row);refresh();}
      if(message.kind==='entry'||message.kind==='progress'){visitedBytes=message.bytes;$('folder-progress').value=message.completed;$('folder-status').textContent=`Inventario ${message.completed}/${message.total} · ${mib(visitedBytes)} · ${message.path??message.row?.path??''}`;}
    }});
    if(scanController!==controller)return;
    inventoryComplete=true;
    $('folder-status').textContent=`Inventario terminado: ${entries.length} archivos. No se ha dibujado ninguna capa. ${entries.filter(e=>e.kind==='error').length} errores.`;
    for(const entry of entries.filter(e=>e.kind==='reference-candidate')){
      try{await setReference(files.get(entry.path));break;}catch{entry.reason='HTML no compatible como referencia; no ejecutado.';}
    }
  }catch(error){if(scanController===controller)$('folder-status').textContent=controller.signal.aborted?'Inventario cancelado. Se conserva el inventario parcial; no equivale a revisión completa.':`Inventario interrumpido: ${error.message}`;}
  finally{if(scanController===controller){scanController=null;scanning=false;render();if(!controller.signal.aborted)await validateCatalog();}}
});
$('folder-base-color').addEventListener('change',()=>{for(const e of entries.filter(e=>e.base)){pending.get(e.path)?.abort();if(active.has(e.path))folderAPI.remove(active.get(e.path));styleChecks.delete(e.path);}bindings.clear();render();validateCatalog();});
$('folder-reference').addEventListener('change',()=>setReference($('folder-reference').files[0]).catch(error=>{$('folder-reference-status').textContent=error.message;}));
$('folder-search').addEventListener('input',()=>{page=0;render();});
$('folder-filter').addEventListener('change',()=>{page=0;render();});$('folder-prev').onclick=()=>{page--;render();};$('folder-next').onclick=()=>{page++;render();};
$('folder-cancel').onclick=()=>{scanController?.abort();operation?.abort();validationController?.abort();progressiveWanted.clear();clearTimeout(viewTimer);for(const c of pending.values())c.abort();};
$('folder-clear').onclick=()=>{clearFolder();$('folder-status').textContent='Carpeta y capas retiradas de memoria; copias locales guardadas no eliminadas.';};
window.addEventListener('arec-context-changed',()=>{stopLoads();page=0;$('folder-search').value='';$('folder-filter').value='context';render();});
window.addEventListener('arec-all-session-cleared',()=>{stopLoads();render();});
window.addEventListener('arec-layer-removed',event=>{for(const [path,id]of active)if(id===event.detail){active.delete(path);if(!reloadingPaths.has(path))progressiveWanted.delete(path);}refresh();});
window.addEventListener('arec-view-changed',()=>{clearTimeout(viewTimer);viewTimer=setTimeout(()=>{for(const path of [...progressiveWanted]){const entry=entries.find(e=>e.path===path);if(entry){let bounds;try{bounds=folderAPI.viewBounds();}catch{continue;}if(windowKey(bounds)!==windowKeys.get(path))toggle(entry,{refreshWindow:true});}}},350);});
$('folder-save').onclick=async()=>{
  if(!$('folder-save-consent').checked){$('folder-storage-status').textContent='Requiere autorización local explícita.';return;}
  if(!entries.length){$('folder-storage-status').textContent='No hay inventario para guardar.';return;}
  if(scanning||operation||validationController){$('folder-storage-status').textContent='Termina o cancela la operación actual.';return;}
  const controller=new AbortController();operation=controller;
  try{
    const result=await saveFolderSnapshot(entries.map(e=>{const templates=matches(e);const mapped=templates.length===1&&e.scope;return {...e,status:mapped?'recognized':e.status,variable:e.variable??(mapped?templates[0].variable:undefined),persistEligible:Boolean(globalReport.layers.find(layer=>layer.path===e.path)?.activatable),file:files.get(e.path)};}),reference,{inventoryState:{totalFiles,complete:inventoryComplete,baseColor:$('folder-base-color').value},signal:controller.signal,onProgress:(n,total)=>{$('folder-storage-status').textContent=`Guardando copia local ${n}/${total}…`;}});
    $('folder-storage-status').textContent=`Copia local completa: ${result.files} archivos activables, ${mib(result.bytes)}. Sujeta a cuota y eliminación del navegador.`;
  }catch(error){$('folder-storage-status').textContent=controller.signal.aborted?'Copia cancelada; se conserva la anterior.':`No se guardó: ${error.message}`;}
  finally{if(operation===controller)operation=null;$('folder-save-consent').checked=false;}
};
$('folder-restore').onclick=async()=>{
  if(scanning||operation)return;
  const generation=folderGeneration;
  try{const saved=await restoreFolderSnapshot();if(generation!==folderGeneration)return;clearFolder();entries=saved.entries.map(({file,...row})=>row);for(const e of saved.entries)if(e.file)files.set(e.path,e.file);reference=saved.reference;if(/^#[0-9a-f]{6}$/i.test(saved.inventoryState?.baseColor??''))$('folder-base-color').value=saved.inventoryState.baseColor;bindings.clear();totalFiles=saved.inventoryState?.totalFiles??entries.length;inventoryComplete=saved.inventoryState?.complete??false;
    $('folder-reference-status').textContent=reference?'Definiciones privadas restauradas localmente.':'Referencia pendiente.';$('folder-status').textContent=`Copia local restaurada: ${entries.length} archivos; ninguna capa dibujada. ${saved.savedAt} · ${inventoryComplete?'inventario completo':'inventario parcial'}`;render();if(reference)await validateCatalog();
  }catch(error){$('folder-storage-status').textContent=error.message;}
};
$('folder-delete').onclick=async()=>{if(operation){$('folder-storage-status').textContent='Cancela primero la operación de almacenamiento.';return;}try{await deleteFolderSnapshot();$('folder-storage-status').textContent='Copia local eliminada de este origen. No implica borrado forense del dispositivo.';}catch(error){$('folder-storage-status').textContent=error.message;}};
render();
