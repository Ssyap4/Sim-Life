import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const path='qa-suv-view.html',out='/tmp/simlife-029-district-courier';
mkdirSync(out,{recursive:true});
writeFileSync(path,`<!doctype html><html><body style="margin:0;background:#c9d7d5"><script type="module">
import * as THREE from 'three';
import {buildFamilyCar} from '/src/game/FamilyCarArt.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc9d7d5);
const car=buildFamilyCar();car.position.set(0,0,0);scene.add(car);
scene.add(new THREE.HemisphereLight(0xf3f9ff,0x8f897c,2.1));
const key=new THREE.DirectionalLight(0xfff3df,3);key.position.set(-4,7,5);scene.add(key);
const fill=new THREE.DirectionalLight(0xdde8ff,1.1);fill.position.set(5,4,-4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x89938c,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(720,540);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(37,720/540,.1,50);
window.drawCar=(x,y,z)=>{camera.position.set(x,y,z);camera.lookAt(0,.9,0);renderer.render(scene,camera);};
window.drawCar(-6,3.2,7);
</script></body></html>`);
let vite,browser;
try{
 vite=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await vite.listen();
 const port=vite.httpServer.address().port;
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:720,height:540},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port+'/'+path);await page.waitForFunction(()=>typeof window.drawCar==='function',undefined,{timeout:30000});
 for(const [name,xyz] of [['front',[-6,3.2,7]],['rear',[6,3.2,-7]],['mobile-isometric',[-6,9,7]]]){
  await page.evaluate(v=>window.drawCar(...v),xyz);await page.screenshot({path:out+'/suv-'+name+'.png'});
 }
 if(errors.length)throw Error(errors.join('; '));
}finally{await browser?.close();await vite?.close();rmSync(path,{force:true});}
