// Pedestrians: low-poly walkers on the sidewalks, each with a home loop between
// two street corners. They stroll, wait at corners, and flee screaming from
// gunfire, car crashes and the player at speed. A hit pedestrian goes down.

import { CITY } from './config.js';
import { pick, range } from './random.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

const SHIRTS = ['#c95f4a', '#4a7fc9', '#5aa84f', '#c9a13a', '#8a5aa8', '#d8d8d8', '#3a3a3a', '#e08a5a'];
const PANTS = ['#2c3242', '#4a3a2c', '#3a4a3a', '#22262b'];

function createPedMesh(shirtColor, pantsColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pickShirtSkin() });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.32), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.6;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), pants);
  legL.position.set(-0.14, 0.34, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), pants);
  legR.position.set(0.14, 0.34, 0);
  group.add(legR);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR, shirt };
}

// Skin tones vary; the pick is per-pedestrian, not per file.
const SKINS = ['#c98d64', '#8a5a38', '#e8b88a', '#6b4423', '#d8a075'];
function pickShirtSkin() {
  return SKINS[Math.floor(Math.random() * SKINS.length)];
}

export function createPedestrians(random, city) {
  const peds = [];
  for (let i = 0; i < 22; i += 1) {
    const street = pick(random, CITY.streets);
    const along = range(random, -224, 224);
    const onX = random() < 0.5;
    const x = onX ? along : street + 8.5;
    const z = onX ? street + 8.5 : along;
    const mesh = createPedMesh(pick(random, SHIRTS), pick(random, PANTS));
    mesh.group.position.set(x, 0, z);
    peds.push({
      mesh,
      x,
      z,
      yaw: range(random, 0, Math.PI * 2),
      speed: range(random, 1.2, 2.2),
      target: null,
      state: 'walk',
      downTimer: 0,
      waitTimer: range(random, 0, 4),
      phase: range(random, 0, Math.PI * 2),
    });
  }
  return peds;
}

/** Pick a new corner to walk to: a random street crossing near the pedestrian. */
function newTarget(ped, random) {
  const street = pick(random, CITY.streets);
  const along = range(random, -224, 224);
  if (random() < 0.5) return { x: along, z: street + 8.5 };
  return { x: street + 8.5, z: along };
}

export function stepPedestrians(peds, city, threat, dt, random) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.mesh.group.rotation.x = Math.min(Math.PI / 2, ped.mesh.group.rotation.x + dt * 4);
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.group.rotation.x = 0;
      }
      continue;
    }
    // Flee from a nearby threat (gunfire, a speeding car, a police chase).
    let fleeX = 0;
    let fleeZ = 0;
    if (threat && threat.active) {
      const dx = ped.x - threat.x;
      const dz = ped.z - threat.z;
      const d = Math.hypot(dx, dz);
      if (d < 26) {
        fleeX = dx / (d || 1);
        fleeZ = dz / (d || 1);
      }
    }
    if (fleeX !== 0 || fleeZ !== 0) {
      ped.state = 'flee';
      ped.yaw = Math.atan2(fleeX, fleeZ);
      ped.x += fleeX * 4.5 * dt;
      ped.z += fleeZ * 4.5 * dt;
      ped.phase += dt * 9;
    } else {
      if (ped.state === 'flee') ped.state = 'walk';
      if (ped.waitTimer > 0) {
        ped.waitTimer -= dt;
      } else {
        if (!ped.target) ped.target = newTarget(ped, random);
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          ped.target = null;
          ped.waitTimer = range(random, 1, 5);
        } else {
          ped.yaw = Math.atan2(dx, dz);
          ped.x += (dx / d) * ped.speed * dt;
          ped.z += (dz / d) * ped.speed * dt;
          ped.phase += dt * ped.speed * 2.4;
        }
      }
    }
    const pushed = collideCircle(city, ped.x, ped.z, 0.5);
    ped.x = pushed.x;
    ped.z = pushed.z;
    const swing = ped.state === 'walk' || ped.state === 'flee' ? Math.sin(ped.phase) * 0.5 : 0;
    ped.mesh.legL.rotation.x = swing;
    ped.mesh.legR.rotation.x = -swing;
    ped.mesh.group.position.set(ped.x, 0, ped.z);
    ped.mesh.group.rotation.y = ped.yaw;
  }
}

/** Knock a pedestrian down (a hit, a hard shove, a crash). */
export function knockDown(ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 6;
}
