/** A failed/invalid health check must never enable code-free access. */
export async function readPreviewConfig(fetcher:typeof fetch=fetch,timeoutMs=6000):Promise<boolean|null>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher('/health',{cache:'no-store',signal:controller.signal});
  if(!response.ok)return null;
  const body:unknown=await response.json();
  return !!body&&typeof body==='object'&&'testNoCodes' in body&&body.testNoCodes===true;
 }catch{return null;}finally{clearTimeout(timer);}
}

/** Bound network transfer, including body download, but don't time out local
 * GLTF parsing. A slow mobile connection must not silently swap character art. */
export const MODEL_TRANSFER_TIMEOUT_MS=45000;
export async function fetchModelBytes(url:string,fetcher:typeof fetch=fetch,timeoutMs=MODEL_TRANSFER_TIMEOUT_MS):Promise<ArrayBuffer>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(url,{signal:controller.signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return await response.arrayBuffer();
 }finally{clearTimeout(timer);}
}
