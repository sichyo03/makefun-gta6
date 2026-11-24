// Solmar Bay v2 — pedestrians: people walking the sidewalks, fleeing from
// gunfire and police chases, and wandering the park and beach.
import { range, pick } from './random.js';

const THREE = window.THREE;

const SHIRT_COLORS = [0xd8d8d8, 0x3a6bd8, 0xd83a6b, 0x3ad86b, 0xe8a03a, 0x8a5ad8, 0x3a3a3a];

function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.0, 0.5),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 1.1;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.48, 0.48),
    new THREE.MeshLambertMaterial({ color: 0xd8a078 }),
  );
  head.position.y = 1.9;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.34), legMat);
    leg.position.set(sx, 0.42, 0);
    leg.name = sx < 0 ? 'legL' : 'legR';
    g.add(leg);
  }
  return g;
}

export function createPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePedMesh(pick(rng, SHIRT_COLORS));
    const x = range(rng, -220, 220);
    const z = range(rng, -220, 220);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.4),
      health: 30,
      radius: 0.9,
      kind: 'ped',
      y: 1.2,
      fleeing: 0,
      phase: rng() * Math.PI * 2,
      dead: false,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, playerPos, danger) {
  for (const p of peds) {
    if (p.dead) continue;
    const dx = p.x - playerPos.x;
    const dz = p.z - playerPos.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (danger && dist < 26) p.fleeing = 2.5;
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      p.heading = Math.atan2(dx, dz);
      p.speed = 5.5;
    } else {
      p.speed = 1.8;
      if (Math.random() < dt * 0.1) p.heading += (Math.random() - 0.5) * 1.2;
    }
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.x = Math.max(-240, Math.min(240, p.x));
    p.z = Math.max(-240, Math.min(290, p.z));
    p.phase += dt * p.speed * 2.2;
    const swing = Math.sin(p.phase) * 0.45;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const legL = p.mesh.getObjectByName('legL');
    const legR = p.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }
}
