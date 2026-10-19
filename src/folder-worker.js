import {resolvePaint} from './style-expressions.js';
import { classifyPath, inspectFile } from './folder-inventory.js';
self.onmessage=async({data})=>{
  if(data.mode==='validate-styles'){
    let completed=0;
    for(const item of data.files){
      let checked=0,failed=0,reason=null;
      try{
        if(classifyPath(item.path).status==='internal-excluded')throw Error('Variable interna excluida; contenido no leído.');
        const result=await inspectFile(item.file,{onFeature:feature=>{checked++;try{resolvePaint(item.paint,feature.properties??{});}catch(error){failed++;reason??=error.message;}}});
        if(result.kind!=='geojson'||!result.renderable)throw Error(result.reason??'Archivo geográfico no compatible.');
      }catch(error){failed++;reason=error.message;}
      completed++;self.postMessage({kind:'style-validation',path:item.path,validation:{status:failed?'failed':'passed',checked,failed,reason},completed,total:data.files.length});
    }
    self.postMessage({kind:'done',completed,total:data.files.length});return;
  }
  if(data.mode==='read'){
    try {const result=await inspectFile(data.file,{collect:true,onBytes:bytes=>self.postMessage({kind:'bytes',bytes})});self.postMessage({kind:'result',result});}
    catch(error){self.postMessage({kind:'failure',message:error.message});}return;
  }
  let completed=0,bytes=0;
  for(const item of data.files){
    const route=classifyPath(item.path);const row={path:item.path,size:item.file.size,lastModified:item.file.lastModified,...route};
    try {
      if(route.status==='unsafe-path')row.reason='Ruta insegura; no se lee.';
      else if(route.status==='internal-excluded'){row.kind='excluded';row.reason='Variable interna: contenido no leído ni activable.';}
      else if(/\.html?$/i.test(item.path)){row.kind='reference-candidate';row.reason='Referencia local potencial; nunca se ejecuta.';}
      else if(/\.(geojson|json)$/i.test(item.path))Object.assign(row,await inspectFile(item.file,{onBytes:read=>self.postMessage({kind:'progress',completed,bytes:bytes+read,total:data.files.length,path:item.path})}));
      else{row.kind='unsupported';row.reason='Formato no compatible; no se lee.';}
    } catch(error){row.kind='error';row.renderable=false;row.reason=error.message;}
    bytes+=item.file.size;completed++;self.postMessage({kind:'entry',row,completed,bytes,total:data.files.length});
  }
  self.postMessage({kind:'done',completed,bytes});
};
