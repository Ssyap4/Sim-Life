import * as THREE from 'three';
import { buildFurnishingModel } from './FurnishingArt';
import { FURNITURE_BY_ID, type FurnitureFinish } from '../shared/furniture';

// Thumbnails are rendered from the EXACT same lightweight geometry as the
// installed piece of furniture. One short-lived offscreen WebGL context
// creates compressed small stills; the game keeps only <img>s, not 39 canvases.
const cache=new Map<string,string>();
type Job={sku:string;finish:FurnitureFinish;
  resolve:(image:string|null)=>void};
const jobs:Job[]=[];
let working=false;
function releaseModel(model:THREE.Group){
  model.traverse(part=>{
    if(!(part instanceof THREE.Mesh))return;
    // All generated models use batched geometry. Only these private buffers
    // are destroyed; shared ArtKit materials and primitives stay alive.
    if(part.geometry.getAttribute('color'))part.geometry.dispose();
  });
}
async function processJobs(){
  if(working)return;
  working=true;
  let renderer:THREE.WebGLRenderer|null=null;
  try{
    renderer=new THREE.WebGLRenderer({
      antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(320,200,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.02;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0xe9ece7);
    scene.add(new THREE.HemisphereLight(0xffffff,0xd1c7ae,1.55));
    const keyLight=new THREE.DirectionalLight(0xffffff,1.9);
    keyLight.position.set(-4,7,6);
    scene.add(keyLight);
    const camera=new THREE.OrthographicCamera(-2,2,1.6,-1.6,.1,30);
    while(jobs.length){
      // Limit GPU work per frame, particularly when opening 39 cards on a phone.
      for(let i=0;i<4&&jobs.length;i++){
        const job=jobs.shift()!;
        const key=job.sku+'/'+job.finish;
        const earlier=cache.get(key);
        if(earlier){job.resolve(earlier);continue;}
        const model=buildFurnishingModel(job.sku,job.finish);
        scene.add(model);
        const bounds=new THREE.Box3().setFromObject(model);
        const size=new THREE.Vector3(),middle=new THREE.Vector3();
        bounds.getSize(size);bounds.getCenter(middle);
        const shape=FURNITURE_BY_ID.get(job.sku)?.shape;
        const flat=shape==='rug',low=shape==='table'||shape==='bed'||shape==='ottoman';
        const span=Math.max(size.x*.77+size.z*.52,size.z*.77+size.x*.52,size.y*1.17,.42);
        const frame=span*.56;
        camera.left=-frame*1.6;camera.right=frame*1.6;
        camera.top=frame;camera.bottom=-frame;
        camera.position.set(middle.x+(flat?3.5:4.4),middle.y+(flat?6.8:low?4.0:3.1),middle.z+(flat?4.0:6.0));
        camera.lookAt(middle.x,middle.y*.82,middle.z);
        camera.updateProjectionMatrix();
        renderer.render(scene,camera);
        const data=renderer.domElement.toDataURL('image/webp',.86);
        cache.set(key,data);
        job.resolve(data);
        scene.remove(model);
        releaseModel(model);
      }
      if(jobs.length)await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
  }catch{
    // When WebGL is unavailable, the text/emoji fallback remains usable.
    while(jobs.length)jobs.shift()!.resolve(null);
  }finally{
    renderer?.dispose();
    renderer?.forceContextLoss();
    working=false;
    if(jobs.length)void processJobs();
  }
}
export function furnitureThumbnail(sku:string,finish:FurnitureFinish):Promise<string|null>{
  const key=sku+'/'+finish;
  const cached=cache.get(key);
  if(cached)return Promise.resolve(cached);
  return new Promise(resolve=>{
    jobs.push({sku,finish,resolve});
    void processJobs();
  });
}
