import * as THREE from 'three';
import { batchRigidParts, cube } from './ArtKit';

const material = (color: number) => new THREE.MeshStandardMaterial({color,roughness:.89});
const paper = material(0xffe9c1);
const ink = material(0x9f8772);
const bristles = material(0xf5f0dc);

function part(parent: THREE.Group, mat: THREE.Material, size: number[], position: number[]) {
  const mesh = new THREE.Mesh(cube,mat);
  mesh.scale.fromArray(size);
  mesh.position.fromArray(position);
  parent.add(mesh);
  return mesh;
}

export function activityProps(figure: THREE.Group, wrists: readonly THREE.Object3D[]) {
  const cover = material(0x6d574b);
  const book = new THREE.Group();
  const leaves = [-1,1].map(sign => {
    const leaf = new THREE.Group();
    part(leaf,cover,[.135,.027,.183],[sign*.067,0,0]);
    part(leaf,paper,[.121,.016,.167],[sign*.066,.017,0]);
    for(let line=0;line<4;line++)
      part(leaf,ink,[.064+line%2*.027,.001,.004],[sign*.065,.026,-.050+line*.025]);
    batchRigidParts(leaf);
    book.add(leaf);
    return leaf;
  });
  const page = new THREE.Group();
  part(page,paper,[.114,.0028,.158],[.058,.022,0]);
  book.add(page);
  book.visible=false;
  figure.add(book);
  const brush = new THREE.Group();
  part(brush,material(0x6cae9c),[.019,.016,.197],[0,0,.062]);
  part(brush,bristles,[.023,.020,.052],[0,.014,.146]);
  wrists[1].add(brush);
  brush.position.set(0,-.039,.020);
  brush.rotation.x = -.34;
  brush.visible=false;
  const left=new THREE.Vector3(),right=new THREE.Vector3();
  return {
    brush,
    hideBook() { book.visible=false; },
    color(value: string) {cover.color.set(value);},
    book(t: number, reading: boolean, closing = 0) {
      wrists[0].getWorldPosition(left);
      wrists[1].getWorldPosition(right);
      book.position.copy(figure.worldToLocal(left.lerp(right,.5)));
      book.position.y += .064;
      book.position.z += .080;
      const opening = reading ? THREE.MathUtils.smoothstep(t,0,.5) : 0;
      const open = Math.max(opening,closing);
      book.rotation.x = -.23-open*.24;
      leaves[0].rotation.z = (1-open)*-1.44;
      leaves[1].rotation.z = (1-open)*1.44;
      const phase = t%10.5;
      page.visible = reading && phase>8.15 && phase<9.10;
      page.rotation.z = THREE.MathUtils.smoothstep(phase,8.15,9.1)*Math.PI;
      book.visible=true;
    },
  };
}
