import * as THREE from 'three';
import type {PlaceId} from '../shared/locations';

/** A painted, three-layer skyline at infinity. Geometry follows view rotation,
 * never camera translation. All ridges and sky bands share a single draw. */
export class LandscapeHorizon {
  private readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;

  constructor(){
    const steps=84, positions:number[]=[], inks:number[]=[], index:number[]=[];
    const colors=new THREE.Color();
    const ridge=(a:number)=>.023*Math.sin(2*a+.4)+.017*Math.cos(5*a)+.007*Math.sin(11*a+.3);
    function strip(lower:(a:number,i:number)=>number, upper:(a:number,i:number)=>number,
      bottom:number,top:number) {
      const start=positions.length/3;
      for(let i=0;i<=steps;i++){
        const a=i*2*Math.PI/steps;
        for(const [height,color] of [[lower(a,i),bottom],[upper(a,i),top]]){
          positions.push(Math.cos(a),height,Math.sin(a));
          colors.setHex(color);inks.push(colors.r,colors.g,colors.b);
        }
        const j=start+i*2;
        if(i)index.push(j-2,j-1,j,j,j-1,j+1);
      }
    }
    strip(()=>.22,()=>12,0xc5d7da,0x91b5d0);
    const far=(a:number)=>ridge(a)*1.1+.060;
    const trees=(a:number,i:number)=>ridge(a+.6)*.7-.025+.009*(i%2);
    const meadow=(a:number)=>ridge(a)*.6-.103;
    strip(far,()=>.22,0xf0dbc2,0xc5d7da);
    strip(trees,far,0xb4c4ba,0xa0b4b3);
    strip(meadow,trees,0xa5b99f,0x8da999);
    strip(()=>-14,meadow,0xa1b28f,0x98ad8b);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(inks,3));
    geometry.setIndex(index);
    const material=new THREE.ShaderMaterial({
      uniforms:{sky:{value:new THREE.Color()},mist:{value:.25}},
      vertexColors:true,side:THREE.DoubleSide,depthWrite:false,depthTest:true,
      vertexShader:`varying vec3 ink;
        void main(){ink=color;vec3 dir=mat3(viewMatrix)*position;
          vec4 clip=projectionMatrix*vec4(dir,1.0);gl_Position=clip.xyww;}`,
      fragmentShader:`uniform vec3 sky;uniform float mist;varying vec3 ink;
        void main(){gl_FragColor=vec4(mix(ink*sky*1.48,sky,mist),1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new THREE.Mesh(geometry,material);
    this.mesh.name='Painted foothills';
    this.mesh.frustumCulled=false;
    this.mesh.renderOrder=10000;
    this.mesh.raycast=()=>{};
  }

  enter(scene:THREE.Scene,place:PlaceId){
    this.mesh.removeFromParent();
    if(['home','district','park','industrial'].includes(place))scene.add(this.mesh);
  }

  tint(sky:THREE.Color,mist:number){
    this.mesh.material.uniforms.sky.value.copy(sky);
    this.mesh.material.uniforms.mist.value=mist;
  }
}
