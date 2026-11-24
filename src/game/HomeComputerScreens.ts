import * as THREE from 'three';
import type { CharacterId } from '../shared/protocol';
import type { ComputerDevice } from '../shared/computer';
import { electronicsVariants,electronicsDisplay } from './ElectronicsArt';
import type { ElectronicsId } from '../shared/electronics';
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
  private readonly initialDesktop:THREE.Group;
  private readonly hardware={desktop:electronicsVariants('desktop'),laptop:electronicsVariants('laptop')};
  private readonly panels:Record<ComputerDevice,THREE.Mesh>;
  private selected:Record<ComputerDevice,ElectronicsId>={desktop:'pcStart',laptop:'laptopStart'};

  constructor(desktop:THREE.Group,laptop:THREE.Group) {
    this.initialDesktop=desktop;
    desktop.add(this.hardware.desktop.group);this.hardware.desktop.group.position.y=1.053;
    laptop.add(this.hardware.laptop.group);this.hardware.laptop.group.position.set(0,.86,-.105);
    const panels={} as Record<ComputerDevice,THREE.Mesh>;
    const add=(device:ComputerDevice):Screen=>{
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;
      const ctx=canvas.getContext('2d')!;
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));
      mesh.position.z=.003;mesh.renderOrder=5;panels[device]=mesh;
      electronicsDisplay(this.hardware[device].select(this.selected[device]))!.add(mesh);
      return {canvas,ctx,texture,lastFrame:-1,lastMode:''};
    };
    this.screens={desktop:add('desktop'),laptop:add('laptop')};this.panels=panels;
  }
  setHardware(desktop:ElectronicsId,laptop:ElectronicsId){
    for(const device of devices){const id=device==='desktop'?desktop:laptop;if(this.selected[device]===id)continue;
      this.selected[device]=id;const model=this.hardware[device].select(id);electronicsDisplay(model)!.add(this.panels[device]);this.screens[device].lastMode='';
    }
  }
  hardwareGroup(device:ComputerDevice){return this.hardware[device].group;}
  /** The exact same hardware and animated texture move to a purchased desk. */
  hostDesktop(desk:THREE.Group|null):void{
    const group=this.hardware.desktop.group;(desk??this.initialDesktop).add(group);
    group.position.set(0,desk?.75:1.053,0);
    group.scale.setScalar(desk?.82:1);
    group.traverse(part=>{if(part instanceof THREE.Mesh){
      if(desk){delete part.userData.interactable;part.userData.furnitureId=desk.userData.furnitureId;}
      else{delete part.userData.furnitureId;part.userData.interactable='desk';}
    }});
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
  career(role:CharacterId,device:ComputerDevice|null,job?:import("../shared/jobs").JobId) {
    const old=this.careers.get(role);
    if(old?.device===device&&old?.scene.job===job)return;
    if(old)this.screens[old.device].lastMode='';
    if(device)this.careers.set(role,{device,scene:{mode:role==='vlad'?'code':'hair',role,job}});
    else this.careers.delete(role);
  }
  resetPreviews(){for(const device of devices)this.preview(device,null);}
  update(seconds:number) {
    for(const device of devices) {
      const screen=this.screens[device],scene=this.current(device);
      const key=[scene.mode,scene.role,scene.game??'',scene.clip??'',scene.job??''].join(':');
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
