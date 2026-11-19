import * as THREE from 'three';
import { PETS, type PetAction, type PetId } from '../shared/pets';
import { buildPetArt } from './PetArt';

export class PetActor {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly paws: THREE.Group[] = [];
  private readonly home: THREE.Vector3;
  private clock = 0;
  private reaction: PetAction | null = null;
  private reactionTime = 0;

  constructor(readonly id: PetId) {
    this.home = new THREE.Vector3(PETS[id].home.x, 0, PETS[id].home.z);
    this.root.position.copy(this.home);
    this.root.add(this.body);
    const dog = id === 'verdell';
    buildPetArt(this.body, this.head, this.tail, this.paws, id);

    // Both models face the viewer/front of the room by default.
    this.body.add(this.head, this.tail);
    this.head.position.set(0, dog ? 0.69 : 0.60, dog ? 0.30 : 0.34);
    this.tail.position.set(0, dog ? 0.55 : 0.42, dog ? -0.39 : -0.43);
    this.root.scale.setScalar(dog ? 1 : 0.95);
  }

  react(action: PetAction): void {
    this.reaction = action;
    this.reactionTime = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.reaction) {
      this.reactionTime += dt;
      if (this.reactionTime > 2.8) this.reaction = null;
    }
    const t = this.clock;
    // Idle wandering is a small cosmetic loop around the shared home marker,
    // without autonomous spending or server-side gameplay decisions.
    const motion = this.reaction === 'play' ? 0.28 : 0.12;
    this.root.position.x = this.home.x + Math.sin(t * 0.7) * motion;
    this.root.position.z = this.home.z + Math.cos(t * 0.56) * motion;
    this.root.rotation.y = Math.sin(t * 0.43) * 0.20;
    this.body.position.y = Math.sin(t * 2.5) * 0.018;
    if (this.reaction === 'play') {
      this.body.position.y += Math.abs(Math.sin(this.reactionTime * 9)) * 0.23;
      this.body.rotation.z = Math.sin(this.reactionTime * 9) * 0.075;
    } else this.body.rotation.z *= 0.86;
    this.head.rotation.z = this.reaction === 'pet' || this.reaction === 'brush'
      ? Math.sin(this.reactionTime * 4) * 0.20
      : Math.sin(t * 1.1) * 0.06;
    this.head.rotation.x = this.reaction === 'feed'
      ? 0.32 + Math.sin(this.reactionTime * 7) * 0.20 : Math.sin(t * 0.84) * 0.035;
    this.tail.rotation.y = Math.sin(t * (this.id === 'verdell' ? 8 : 3.8)) *
      (this.reaction ? 0.53 : 0.24);
    for (let i = 0; i < this.paws.length; i++) {
      this.paws[i].rotation.x = this.reaction === 'play'
        ? Math.sin(this.reactionTime * 9 + (i % 2) * Math.PI) * 0.30 : 0;
    }
  }
}
