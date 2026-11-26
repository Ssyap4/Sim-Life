import * as THREE from 'three';
import { electronicsVariants } from './ElectronicsArt';
import type { ElectronicsId } from '../shared/electronics';
import { batchRigidParts, cube } from './ArtKit';

const material = (color: number) => new THREE.MeshStandardMaterial({color,roughness:.89});
const paper = material(0xffe9c1);
const ink = material(0x9f8772);
const bristles = material(0xf5f0dc);
const steel = material(0xa4a8a2);

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
  book.name = 'Held book';
  const leaves = [-1,1].map(sign => {
    const leaf = new THREE.Group();
    leaf.name=sign<0?'Book left cover':'Book right cover';
    part(leaf,cover,[.135,.027,.183],[sign*.067,0,0]);
    part(leaf,paper,[.121,.016,.167],[sign*.066,.017,0]);
    for(let line=0;line<4;line++)
      part(leaf,ink,[.064+line%2*.027,.001,.004],[sign*.065,.026,-.050+line*.025]);
    batchRigidParts(leaf);
    book.add(leaf);
    return leaf;
  });
  const page = new THREE.Group();
  page.name='Turning page';
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
  // A separate, lightweight grooming brush: the teeth-cleaning toothbrush
  // cannot convincingly stand in for brushing Simba or Verdell.
  const groomingBrush = new THREE.Group();
  groomingBrush.name = 'Pet grooming brush';
  const wood = material(0xae7b4e);
  part(groomingBrush, wood, [.031,.024,.174], [0,0,.055]);
  part(groomingBrush, wood, [.097,.032,.102], [0,.006,.153]);
  for (const x of [-.027,0,.027]) for (const z of [-.031,0,.031])
    part(groomingBrush,bristles,[.012,.028,.017],[x,.034,.153+z]);
  // Merge the wooden pieces and nine bristle tufts into two draw calls.
  batchRigidParts(groomingBrush);
  groomingBrush.position.set(0,-.043,.036);
  groomingBrush.rotation.x = -.20;
  groomingBrush.visible=false;
  wrists[1].add(groomingBrush);
  const knife = new THREE.Group();
  knife.name = 'Cooking knife';
  part(knife, material(0x665447), [.025,.028,.095], [0,0,.036]);
  part(knife, steel, [.012,.052,.142], [0,.011,.142]);
  batchRigidParts(knife);
  knife.position.set(0,-.067,.026);
  knife.rotation.x=.12;
  knife.visible=false;
  wrists[1].add(knife);
  const spatula=new THREE.Group();
  spatula.name='Cooking spatula';
  part(spatula,material(0x665447),[.023,.022,.11],[0,0,.045]);
  part(spatula,steel,[.015,.012,.09],[0,0,.13]);
  part(spatula,steel,[.067,.009,.092],[0,-.008,.209]);
  batchRigidParts(spatula);
  wrists[1].add(spatula);spatula.visible=false;
  const fork = new THREE.Group();
  fork.name='Dining fork';
  part(fork,steel,[.012,.012,.195],[0,0,.098]);
  for(const x of [-.020,-.007,.007,.020])
    part(fork,steel,[.005,.011,.065],[x,0,.224]);
  batchRigidParts(fork);
  fork.position.set(-.012,-.043,.024);
  fork.rotation.x=.25;
  fork.visible=false;
  wrists[1].add(fork);
  const phoneVariants=electronicsVariants('phone'),phone=phoneVariants.group;
  phoneVariants.select('phoneStart');figure.add(phone);phone.name='Held phone';phone.visible=false;
  const tongs = new THREE.Group();
  tongs.position.set(0, -.090, .043);
  const jaws = [-1, 1].map(side => part(tongs, steel, [.013, .013, .202], [.016 * side, 0, .072]));
  wrists[1].add(tongs);
  tongs.visible = false;
  return {
    heldBook:book,
    bookLeaves:leaves,
    bookPage:page,
    brush,
    phone,
    setPhone(id:ElectronicsId){phoneVariants.select(id);},
    groomingBrush,
    knife,
    spatula,
    fork,
    tongs,
    grip(time: number) {
      const opening = .07 + .075 * (1 + Math.sin(time * 4));
      jaws[0].rotation.y = -opening;
      jaws[1].rotation.y = opening;
    },
    hideBook() { book.visible=false; },
    color(value: string) {cover.color.set(value);},
    book(t: number, reading: boolean, closing = 0) {
      if (reading || closing > 0) {
        if (book.parent !== figure) figure.add(book);
        // The Actor places the book first and solves the wrists against its
        // physical cover and page, not the midpoint of two moving hands.
      } else {
        if (book.parent !== wrists[1]) wrists[1].add(book);
        book.position.set(.034, -.069, .035);
        book.rotation.set(.18, 0, Math.PI / 2);
      }
      const opening = reading ? THREE.MathUtils.smoothstep(t,0,.5) : 0;
      const open = Math.max(opening,closing);
      leaves[0].rotation.z = (1-open)*-1.44;
      leaves[1].rotation.z = (1-open)*1.44;
      const phase = t%10.5;
      page.visible = reading && phase>8.15 && phase<9.10;
      page.rotation.z = THREE.MathUtils.smoothstep(phase,8.15,9.1)*Math.PI;
      book.updateWorldMatrix(true,true);
      book.visible=true;
    },
  };
}
