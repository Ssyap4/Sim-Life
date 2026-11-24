/** A visual-only preview preset, not gameplay weather. */
export function snowPreview(query=typeof window==='undefined'?'':window.location.search):boolean{return new URLSearchParams(query).get('weather')==='snow';}
