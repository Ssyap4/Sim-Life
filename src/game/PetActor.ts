import * as THREE from 'three';
import { PETS, type PetAction, type PetId } from '../shared/pets';
import { buildPetArt } from './PetArt';

export class PetActor {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly paws: THREE.Group[] = [];
  private readonly rig: ReturnType<typeof buildPetArt>;
  private clock = 0;
  private reaction: PetAction | null = null;
  private reactionTime = 0;

  constructor(readonly id: PetId) {
    const { x, z } = PETS[id].home;
    this.root.position.set(x, 0, z);
    this.root.add(this.body);
    const dog = id === 'verdell';
    this.rig = buildPetArt(this.body, this.head, this.tail, this.paws, id);
    this.body.add(this.head, this.tail);
    this.head.position.set(0, dog ? 0.728 : 0.537, dog ? 0.241 : 0.325);
    this.tail.position.set(0, dog ? 0.458 : 0.415, dog ? -0.454 : -0.501);
    this.root.rotation.y = dog ? 0.20 : 0.21;
  }

  react(action: PetAction): void {
    this.reaction = action;
    this.reactionTime = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    this.reactionTime += dt;
    const dog = this.id === 'verdell';
    const t = this.clock + (dog ? 0 : 1.75);
    const r = this.reactionTime;
    if (r > 2.75) this.reaction = null;
    const weight = this.reaction ? Math.sin(Math.PI * Math.min(1, r / 2.75)) : 0;
    const playful = this.reaction === 'play' ? weight : 0;
    const eating = this.reaction === 'feed' ? weight : 0;
    const attention = this.reaction === 'pet' || this.reaction === 'brush' ? weight : 0;
    const smooth = 1 - Math.exp(-dt * 12);
    const pulse = Math.sin(t * (dog ? 2.6 : 1.9));
    const lift = Math.max(0, Math.sin(r * 8)) * playful;
    this.body.scale.y = 1 + pulse * (dog ? 0.016 : 0.011) - eating * 0.045;
    this.body.position.y = 0.081 + lift * (dog ? 0.090 : 0.125);
    this.body.rotation.z = Math.sin(r * 8) * playful * 0.058;
    this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x,
      pulse * 0.018 + eating * (0.62 + Math.sin(r * 8) * 0.09) - attention * 0.16, smooth);
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y,
      (dog ? 0.23 : 0.36) * Math.sin(t * 0.49) ** 5 + attention * 0.22, smooth);
    this.head.rotation.z = THREE.MathUtils.lerp(this.head.rotation.z,
      (dog ? 0.035 : 0.021) * Math.sin(t * 0.92) + attention * (dog ? 0.19 : -0.14), smooth);
    this.rig.jaw.position.y = (dog ? -0.007 * pulse : 0) - eating * (0.010 + 0.012 * Math.sin(r * 12));
    this.tail.rotation.y = dog
      ? (0.09 + 0.55 * weight) * Math.sin(t * (playful ? 13 : 5.2))
      : (0.14 + 0.27 * playful) * Math.sin(t * 1.7) + 0.065 * Math.sin(t * 3.5);
    this.tail.rotation.x = dog ? 0.025 * pulse : 0.09 * pulse - attention * 0.10;
    const blinkPhase = t % (dog ? 5.3 : 6.4);
    const blink = blinkPhase < 0.22 ? 1 - 0.9 * Math.sin(blinkPhase / 0.22 * Math.PI) : 1;
    for (let i = 0; i < 2; i++) {
      this.rig.eyes[i].scale.y = THREE.MathUtils.lerp(this.rig.eyes[i].scale.y,
        blink * (1 - (dog ? 0.22 : 0.50) * attention), smooth);
      const ear = this.rig.ears[i];
      const flick = Math.max(0, Math.sin(t * 1.19 + i * 2)) ** 12;
      ear.rotation.x = flick * (dog ? 0.055 : 0.20) + attention * 0.11;
      ear.rotation.y = (i === 0 ? 1 : -1) * flick * (dog ? 0.06 : 0.24);
    }
    for (let i = 0; i < this.paws.length; i++) {
      this.paws[i].rotation.x = Math.sin(r * 8 + (i % 2) * Math.PI) * playful * 0.27;
    }
  }
}
