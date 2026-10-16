(function bulkMain(){
"use strict";
const $=id=>document.getElementById(id);
const CODES=new Set(["JRZ","CHH","SLT","TOR","MTY","HMO","OBR","MXL","TIJ","GDL","QRO","VER","LEO","PUE","TOL","CAN","SLP","AGS"]);
const EXCLUDED=new Set(["V15","V16","V17","V18"]);
const sourcePanel=document.querySelector(".left-panel");
if(!sourcePanel||!$("local-pilot-form"))return;
const panel=document.createElement("details");
panel.open=true;
panel.innerHTML=[
'<summary>Carpeta AREC GEO · Importación masiva privada</summary>',
'<p class="muted">Selecciona la carpeta data una vez. Solo se inventarían rutas, plazas y variables; no se cargan geometrías hasta que elijas una capa. Los archivos permanecen en tu navegador.</p>',
'<label>Carpeta data<input id="bulk-dir" type="file" multiple></label>',
'<label>Referencia V15 local (una sola vez)<input id="bulk-v15" type="file" accept=".html,.htm"></label>',
'<label class="check"><input id="bulk-permit" type="checkbox"> Autorizo una copia opcional en IndexedDB de este navegador</label>',
'<div class="button-grid"><button type="button" id="bulk-go">Inventariar carpeta</button><button type="button" id="bulk-stop">Cancelar</button><button type="button" id="bulk-restore">Restaurar copia</button><button type="button" id="bulk-wipe">Borrar copia</button></div>',
'<progress id="bulk-progress" max="100" value="0" style="width:100%"></progress>',
'<p id="bulk-message" role="status" class="muted">Sin carpeta inventariada.</p>',
'<p id="bulk-totals" class="muted"></p>',
'<label>Filtrar archivos de plaza y ámbito actuales<input id="bulk-query" type="search" placeholder="V13, expansion, V14…"></label>',
'<div id="bulk-list"></div>',
'<p class="muted">V15–V18 no se pueden activar. La presencia de un archivo no certifica cálculos ni cobertura. La simbología debe verificarse contra el HTML V15 local.</p>'
].join("");
sourcePanel.prepend(panel);
$("bulk-dir").setAttribute("webkitdirectory","");
$("bulk-dir").multiple=true;
let inventory=[],excluded=0,reference=null,worker=null,generation=0,saving=false,pendingReject=null;
const msg=s=>$("bulk-message").textContent=s;
function parse(file,index){
 const path=(file.webkitRelativePath||file.name).replace(/\\/g,"/");
 const bits=path.split("/");
 if(bits.some(v=>!v||v==="."||v===".."||v.length>180))return null;
 const k=bits.findIndex((v,i)=>CODES.has(v.toUpperCase())&&["evidence","evidence_metro"].includes(bits[i+1]));
 if(k<0)return null;
 const variable=(bits[k+2]||"").toUpperCase();
 if(!/^V(0[1-9]|1[0-9]|2[0-3])$/.test(variable))return null;
 if(EXCLUDED.has(variable))return {internal:true};
 if(!/\.geojson$/i.test(file.name)||file.size===0||file.size>25*1048576)return null;
 return {index,path,plaza:bits[k].toUpperCase(),scope:bits[k+1]==="evidence_metro"?"metro_analysis":"city",variable,name:file.name,size:file.size,file};
}
function render(){
 const plaza=$("plaza").value,scope=$("scope").value,q=$("bulk-query").value.toLowerCase();
 const subset=inventory.filter(x=>x.plaza===plaza&&x.scope===scope);
 const counts={};for(const x of subset)counts[x.variable]=(counts[x.variable]||0)+1;
 $("bulk-totals").textContent=inventory.length+" archivos válidos en "+new Set(inventory.map(x=>x.plaza)).size+" plazas; "+subset.length+" del ámbito actual. "+Object.entries(counts).map(([v,n])=>v+": "+n).join(" · ")+(excluded?" · Internos excluidos: "+excluded:"");
 const box=$("bulk-list");box.replaceChildren();let shown=0;
 for(const x of subset){
  if(q&&!(x.variable+" "+x.name).toLowerCase().includes(q))continue;
  if(++shown>65)break;
  const div=document.createElement("div");div.style.cssText="display:flex;gap:6px;padding:5px 0;border-top:1px solid #495969";
  const label=document.createElement("span");label.style.cssText="flex:1;overflow-wrap:anywhere";label.textContent=x.variable+" · "+x.name+" · "+(x.size/1048576).toFixed(2)+" MB";
  const btn=document.createElement("button");btn.type="button";btn.textContent="Preparar";btn.onclick=()=>prepare(x);
  div.append(label,btn);box.append(div);
 }
 if(shown>65){const p=document.createElement("p");p.className="muted";p.textContent="Se muestran 65 archivos. Utiliza el filtro para encontrar más.";box.append(p);}
}
$("bulk-query").oninput=render;
$("plaza").addEventListener("change",render);
$("scope").addEventListener("change",render);
$("bulk-v15").onchange=()=>{const f=$("bulk-v15").files[0];reference=f&&/\.html?$/i.test(f.name)&&f.size<=2*1048576?f:null;msg(reference?"Referencia V15 seleccionada para esta sesión.":"Selecciona un HTML V15 válido, menor de 2 MB.");};
function workerRun(){
 const allowed=new Set(["JRZ","CHH","SLT","TOR","MTY","HMO","OBR","MXL","TIJ","GDL","QRO","VER","LEO","PUE","TOL","CAN","SLP","AGS"]);
 self.onmessage=e=>{
  const metadata=e.data,accepted=[],internal=[];
  for(let i=0;i<metadata.length;i++){
   const x=metadata[i],p=x.path.replace(/\\/g,"/").split("/");
   const k=p.findIndex((v,j)=>allowed.has(v.toUpperCase())&&["evidence","evidence_metro"].includes(p[j+1]));
   if(k>=0 && /^V(0[1-9]|1[0-9]|2[0-3])$/i.test(p[k+2]||"") && /\.geojson$/i.test(x.name) && x.size>0 && x.size<=25*1048576){
    if(["V15","V16","V17","V18"].includes(p[k+2].toUpperCase()))internal.push(i);else accepted.push(i);
   }
   if(i%100===0||i===metadata.length-1)postMessage({progress:i+1,total:metadata.length});
  }
  postMessage({accepted,internal:internal.length});
 };
}
function abort(){generation++;if(pendingReject){pendingReject(Error("Cancelado"));pendingReject=null;}if(worker){worker.terminate();worker=null;}msg("Operación cancelada; el inventario anterior se conserva.");}
$("bulk-stop").onclick=abort;
$("bulk-go").onclick=async()=>{
 const files=Array.from($("bulk-dir").files);
 if(!files.length){msg("Selecciona la carpeta raíz data.");return;}
 if(files.length>10000){msg("Máximo 10,000 archivos por selección.");return;}
 abort();const ticket=generation;$("bulk-progress").value=0;msg("Inventariando "+files.length+" archivos, sin leer geometrías…");
 const url=URL.createObjectURL(new Blob(["("+workerRun.toString()+")()"],{type:"text/javascript"}));
 try{
  const result=await new Promise((resolve,reject)=>{
   pendingReject=reject;
   worker=new Worker(url);
   worker.onmessage=event=>{
    if(ticket!==generation){reject(Error("Cancelado"));return;}
    if(event.data.accepted)resolve(event.data);
    else $("bulk-progress").value=Math.round(100*event.data.progress/event.data.total);
   };
   worker.onerror=()=>reject(Error("El trabajador de inventario no está disponible."));
   worker.postMessage(files.map(f=>({path:f.webkitRelativePath||f.name,name:f.name,size:f.size})));
  });
  if(ticket!==generation)return;
  const next=result.accepted.map(i=>parse(files[i],i)).filter(x=>x&&!x.internal);
  next.sort((a,b)=>a.plaza.localeCompare(b.plaza)||a.scope.localeCompare(b.scope)||a.variable.localeCompare(b.variable)||a.name.localeCompare(b.name));
  inventory=next;excluded=result.internal;
  $("bulk-progress").value=100;render();
  msg("Inventario completo: "+next.length+" GeoJSON de "+new Set(next.map(x=>x.plaza)).size+" plazas. No se ha cargado ningún archivo al mapa.");
  if($("bulk-permit").checked)await saveLocal(next,ticket);
 }catch(e){if(ticket===generation)msg("Inventario no completado: "+e.message);}
 finally{pendingReject=null;if(worker){worker.terminate();worker=null;}URL.revokeObjectURL(url);}
};
function putInput(id,file){
 const d=new DataTransfer();d.items.add(file);$(id).files=d.files;$(id).dispatchEvent(new Event("change"));
}
async function prepare(rec){
 if(rec.plaza!==$("plaza").value||rec.scope!==$("scope").value){msg("Plaza/ámbito no coincidente.");return;}
 reference=reference||$("bulk-v15").files[0];
 if(!reference){msg("Selecciona una vez el HTML original V15; no aplicaré simbología supuesta.");return;}
 if(!$("local-reference")||!$("local-cells")){msg("No se encontró el visor privado V15.");return;}
 putInput("local-reference",reference);
 putInput("local-cells",rec.file);
 $("local-variable").value=rec.variable;
 $("local-variable").dispatchEvent(new Event("change"));
 await new Promise(r=>setTimeout(r,250));
 $("local-sublayer").value="";
 $("local-consent").checked=false;
 const form=$("local-pilot-form");form.closest("details").open=true;
 msg("Preparado "+rec.variable+" / "+rec.name+". En Demostración privada selecciona la subcapa V15 correspondiente; confirma el consentimiento y pulsa Preparar capa privada. No se asignan colores por adivinación.");
 form.scrollIntoView({behavior:"smooth",block:"center"});
}
const DB="arec-geo-folder-private-v1";
const req=r=>new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error||Error("IndexedDB"));});
const dbopen=()=>new Promise((ok,fail)=>{
 if(!window.indexedDB){fail(Error("IndexedDB no disponible"));return;}
 const x=indexedDB.open(DB,1);
 x.onupgradeneeded=()=>x.result.createObjectStore("items",{keyPath:"key"});
 x.onsuccess=()=>ok(x.result);x.onerror=()=>fail(x.error);
});
const txdone=t=>new Promise((ok,fail)=>{t.oncomplete=ok;t.onabort=()=>fail(t.error);t.onerror=()=>fail(t.error);});
async function write(db,x){const t=db.transaction("items","readwrite");const done=txdone(t);t.objectStore("items").put(x);await done;}
async function snapshot(db,prefix,withValue){
 const t=db.transaction("items","readonly"),s=t.objectStore("items");
 return await new Promise((ok,fail)=>{
  const values=[],c=s.openCursor(IDBKeyRange.bound(prefix,prefix+"\uffff"));
  c.onsuccess=()=>{const a=c.result;if(!a){ok(values);return;}values.push(withValue?a.value:a.key);a.continue();};
  c.onerror=()=>fail(c.error);
 });
}
async function removeKeys(db,keys){
 for(let i=0;i<keys.length;i+=80){
  const t=db.transaction("items","readwrite"),done=txdone(t);
  for(const key of keys.slice(i,i+80))t.objectStore("items").delete(key);
  await done;
 }
}
async function saveLocal(entries,ticket){
 if(saving)return;
 saving=true;let db,gen="copy-"+Date.now()+"-"+Math.random().toString(36).slice(2);
 try{
  db=await dbopen();msg("Guardando copia local con autorización, sujeto a cuota del navegador…");
  for(let i=0;i<entries.length;i++){
   if(ticket!==generation)throw Error("Cancelación solicitada");
   const v=entries[i];await write(db,{key:gen+"/"+String(i).padStart(6,"0"),file:v.file,meta:{path:v.path,name:v.name,plaza:v.plaza,scope:v.scope,variable:v.variable,size:v.size}});
   if(i%50===0)msg("Guardando "+(i+1)+" / "+entries.length+" archivos en este navegador…");
  }
  if(ticket!==generation)throw Error("Cancelación solicitada");
  const t=db.transaction("items","readwrite"),done=txdone(t),store=t.objectStore("items");
  const old=await req(store.get("active"));
  store.put({key:"active",gen,files:entries.length});await done;
  msg("Copia local guardada. La restauración nunca será automática.");
  if(old?.gen)await removeKeys(db,await snapshot(db,old.gen+"/",false));
 }catch(e){msg("No se pudo guardar: "+e.message+". Si había una copia anterior, se conservó.");if(db)try{await removeKeys(db,await snapshot(db,gen+"/",false));}catch{}}
 finally{db?.close();saving=false;}
}
$("bulk-restore").onclick=async()=>{
 if(saving)return;
 let db;try{
  db=await dbopen();const t=db.transaction("items","readonly");const saved=await req(t.objectStore("items").get("active"));
  if(!saved?.gen){msg("No hay copia local guardada.");return;}
  const entries=await snapshot(db,saved.gen+"/",true);
  inventory=entries.filter(x=>x.file&&x.meta&&CODES.has(x.meta.plaza)&&!EXCLUDED.has(x.meta.variable)).map((x,i)=>({...x.meta,index:i,file:x.file}));
  excluded=0;render();msg("Restaurados "+inventory.length+" GeoJSON de forma privada. No se activaron capas.");
 }catch(e){msg("Error de restauración: "+e.message);}finally{db?.close();}
};
$("bulk-wipe").onclick=async()=>{
 if(saving||!confirm("¿Eliminar la copia local de datos AREC GEO de este navegador?"))return;
 let db;try{
  db=await dbopen();const t=db.transaction("items","readwrite"),done=txdone(t);
  t.objectStore("items").clear();await done;msg("Copia local eliminada; el inventario de esta sesión se conserva.");
 }catch(e){msg("No se pudo borrar: "+e.message);}finally{db?.close();}
};
render();
})();