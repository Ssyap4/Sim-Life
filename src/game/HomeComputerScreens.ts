import * as THREE from 'three';
import type { CharacterId } from '../shared/protocol';
import type { ComputerDevice } from '../shared/computer';
import { drawComputerScene, type ComputerScene } from './ComputerScreenArt';

type Screen = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture;
  lastFrame:number; lastMode:string };
const devices: readonly ComputerDevice[]=['desktop','laptop'];

/** Two small independent display textures, 8 fps only while an activity is visible. */
export class HomeComputerScreens {
  private readonly screens: Record<ComputerDevice, Screen>;
  private readonly tasks = new Map<CharacterId,{device:ComputerDevice;scene:ComputerScene}>();
  private readonly careers = new Map<CharacterId,{device:ComputerDevice;scene:ComputerScene}>();
  private readonly previews: Partial<Record<ComputerDevice, ComputerScene>> = {};

  constructor(desktop:THREE.Group,laptop:THREE.Group) {
    const add=(parent:THREE.Group,device:ComputerDevice):Screen=>{
      const canvas=document.createElement('canvas');
      canvas.width=256;canvas.height=144;
      const ctx=canvas.getContext('2d')!;
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;
      texture.magFilter=THREE.LinearFilter;
      const laptopScreen=device==='laptop';
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(laptopScreen?.464:.994,laptopScreen?.256:.634),
        new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide,depthWrite:false}));
      if (laptopScreen) {
        // Follow the same lid tilt as CareerArt; remain just in front of its static screen.
        mesh.position.set(0,1.059,-.008);
        mesh.rotation.x=-.2;
      } else mesh.position.set(0,1.52,-.211);
      mesh.renderOrder=5;
      mesh.castShadow=false;mesh.receiveShadow=false;
      parent.add(mesh);
      return {canvas,ctx,texture,lastFrame:-1,lastMode:''};
    };
    this.screens={desktop:add(desktop,'desktop'),laptop:add(laptop,'laptop')};
  }

  private current(device:ComputerDevice):ComputerScene {
    for (const entry of this.tasks.values()) if(entry.device===device)return entry.scene;
    for (const entry of this.careers.values()) if(entry.device===device)return entry.scene;
    return this.previews[device]??{mode:'idle',role:device==='desktop'?'vlad':'alina'};
  }

  preview(device:ComputerDevice,scene:ComputerScene|null) {
    if(scene)this.previews[device]=scene;
    else delete this.previews[device];
    this.screens[device].lastMode='';
  }
  task(role:CharacterId,device:ComputerDevice,scene:ComputerScene) {
    this.tasks.set(role,{device,scene});
    this.screens[device].lastMode='';
  }
  endTask(role:CharacterId) {
    const old=this.tasks.get(role);
    if(old)this.screens[old.device].lastMode='';
    this.tasks.delete(role);
  }
  career(role:CharacterId,device:ComputerDevice|null) {
    const old=this.careers.get(role);
    if(old?.device===device)return;
    if(old)this.screens[old.device].lastMode='';
    if(device)this.careers.set(role,{device,scene:{mode:role==='vlad'?'code':'hair',role}});
    else this.careers.delete(role);
  }
  resetPreviews(){for(const device of devices)this.preview(device,null);}
  update(seconds:number) {
    for(const device of devices) {
      const screen=this.screens[device],scene=this.current(device);
      const key=[scene.mode,scene.role,scene.game??'',scene.clip??''].join(':');
      const active=scene.mode!=='idle';
      const frame=Math.floor(seconds*(active?8:1));
      if(key===screen.lastMode && frame===screen.lastFrame)continue;
      screen.lastMode=key;screen.lastFrame=frame;
      drawComputerScene(screen.ctx,scene,seconds);
      screen.texture.needsUpdate=true;
    }
  }
  dispose() {
    for(const device of devices)this.screens[device].texture.dispose();
  }
}
