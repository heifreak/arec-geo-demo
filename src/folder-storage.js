const DATABASE='arec-private-folder-v1';
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function open(){if(!globalThis.indexedDB)throw Error('IndexedDB no disponible en este origen.');const req=indexedDB.open(DATABASE,1);req.onupgradeneeded=()=>req.result.createObjectStore('records');return request(req);}
function done(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Transacción cancelada.'));});}
async function put(db,key,value){const tx=db.transaction('records','readwrite');const finished=done(tx);tx.objectStore('records').put(value,key);await finished;}
async function removePrefix(db,prefix){const tx=db.transaction('records','readwrite');const finished=done(tx);const store=tx.objectStore('records');const req=store.openKeyCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));req.onsuccess=()=>{const cursor=req.result;if(cursor){store.delete(cursor.key);cursor.continue();}};await finished;}
export async function saveFolderSnapshot(entries,reference,{inventoryState={complete:false,totalFiles:entries.length},signal,onProgress=()=>{},estimate=()=>navigator.storage?.estimate?.()??Promise.resolve({})}={}){
  const eligible=entries.filter(e=>e.status==='recognized'&&e.renderable&&e.file);
  const eligibleSet=new Set(eligible);
  const bytes=eligible.reduce((sum,e)=>sum+e.size,0);const quota=await estimate();
  if(Number.isFinite(quota.quota)&&Number.isFinite(quota.usage)&&bytes>quota.quota-quota.usage)throw Error('Espacio local insuficiente; no se reemplaza la copia anterior.');
  const db=await open();const prefix=crypto.randomUUID()+':';let committed=false;
  try{
    signal?.throwIfAborted();
    for(let i=0;i<entries.length;i++){
      signal?.throwIfAborted();const e=entries[i];const {file,...metadata}=e;
      await put(db,prefix+String(i).padStart(8,'0'),{...metadata,...(eligibleSet.has(e)?{file}:{})});onProgress(i+1,entries.length);
    }
    signal?.throwIfAborted();const tx=db.transaction('records','readonly');const previous=await request(tx.objectStore('records').get('active'));
    await put(db,'active',{prefix,reference,inventoryState,count:entries.length,bytes,savedAt:new Date().toISOString()});committed=true;
    if(previous?.prefix)await removePrefix(db,previous.prefix).catch(()=>{});
    return {files:eligible.length,bytes,savedAt:new Date().toISOString()};
  }catch(error){if(!committed)await removePrefix(db,prefix).catch(()=>{});throw error;}finally{db.close();}
}
export async function restoreFolderSnapshot(){
  const db=await open();try{
    const tx=db.transaction('records','readonly');const active=await request(tx.objectStore('records').get('active'));
    if(!active)throw Error('No hay copia local completa en este origen.');
    const read=db.transaction('records','readonly');const entries=await request(read.objectStore('records').getAll(IDBKeyRange.bound(active.prefix,active.prefix+'\uffff')));
    if(entries.length!==active.count)throw Error('Copia local incompleta; vuelve a seleccionar la carpeta.');
    return {entries,reference:active.reference,inventoryState:active.inventoryState,savedAt:active.savedAt};
  }finally{db.close();}
}
export async function deleteFolderSnapshot(){const db=await open();try{const tx=db.transaction('records','readwrite');const finished=done(tx);tx.objectStore('records').clear();await finished;}finally{db.close();}}
