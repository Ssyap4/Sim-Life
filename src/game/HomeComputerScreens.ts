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
  private readonly initialDesktop:THREE.Group;
  private desktopPanel!:THREE.Mesh;
  private monitorStand:THREE.Group|null=null;

  constructor(desktop:THREE.Group,laptop:THREE.Group) {
    this.initialDesktop=desktop;
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
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(laptopScreen?.456:.994,laptopScreen?.2565:.634),
        new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:laptopScreen?THREE.FrontSide:THREE.DoubleSide,depthWrite:laptopScreen}));
      const surface=laptopScreen?parent.getObjectByName('Laptop display surface'):parent;
      if (!laptopScreen) {
        mesh.position.set(0,1.52,-.211);
        this.desktopPanel=mesh;
      }
      mesh.renderOrder=5;
      mesh.castShadow=false;mesh.receiveShadow=false;
      surface?.add(mesh);
      return {canvas,ctx,texture,lastFrame:-1,lastMode:''};
    };
    this.screens={desktop:add(desktop,'desktop'),laptop:add(laptop,'laptop')};
  }

  /** Reattach the SAME working desktop screen to a replacement desk.
   * It keeps the old texture and 8fps budget; no second simulated PC is spawned. */
  hostDesktop(desk:THREE.Group|null):void{
    if(!desk){
      this.monitorStand?.removeFromParent();
      this.initialDesktop.add(this.desktopPanel);
      this.desktopPanel.position.set(0,1.52,-.211);
      return;
    }
    if(!this.monitorStand){
      const stand=new THREE.Group();
      const shell=new THREE.Mesh(new THREE.BoxGeometry(1.10,.73,.085),
        new THREE.MeshStandardMaterial({color:0x303b42,roughness:.68}));
      shell.position.set(0,1.255,-.15);
      const pillar=new THREE.Mesh(new THREE.BoxGeometry(.075,.27,.08),
        new THREE.MeshStandardMaterial({color:0x53616b,roughness:.71}));
      pillar.position.set(0,.905,-.15);
      const base=new THREE.Mesh(new THREE.BoxGeometry(.34,.035,.22),
        new THREE.MeshStandardMaterial({color:0x36414a}));
      base.position.set(0,.77,-.15);
      const keyboard=new THREE.Mesh(new THREE.BoxGeometry(.64,.025,.23),
        new THREE.MeshStandardMaterial({color:0xb8bcb7,roughness:.78}));
      keyboard.position.set(0,.775,.19);
      stand.add(shell,pillar,base,keyboard);
      this.monitorStand=stand;
    }
    desk.add(this.monitorStand);
    this.monitorStand.add(this.desktopPanel);
    this.desktopPanel.position.set(0,1.255,-.103);
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
