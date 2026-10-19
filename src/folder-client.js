export function workerJob(message,{signal,onMessage=()=>{}}={}) {
  if(signal?.aborted)return Promise.reject(signal.reason);
  const source=typeof __FOLDER_WORKER_SOURCE__==='string'?__FOLDER_WORKER_SOURCE__:'';
  if(!source)throw Error('Worker no empaquetado. Reconstruye la vista previa.');
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const worker=new Worker(url);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{worker.terminate();URL.revokeObjectURL(url);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(signal.reason??new DOMException('Cancelado','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>{cleanup();reject(Error('Error del worker local. No se transmitieron archivos.'));};
    worker.onmessage=({data})=>{onMessage(data);if(data.kind==='done'||data.kind==='result'){cleanup();resolve(data.result??data);}else if(data.kind==='failure'){cleanup();reject(Error(data.message));}};
    worker.postMessage(message);
  });
}
