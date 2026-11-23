// Combat: the pistol. A click fires a hitscan shot from the camera through the
// crosshair; a tracer line and a muzzle flash mark it, and the first thing the ray
// meets takes damage. Police shoot back at high wanted levels. Health regens
// slowly when the player has been out of trouble for a while.

import { PLAYER } from './config.js';

const THREE = window.THREE;

export function createCombat() {
  return {
    cooldown: 0,
    tracer: null,
    tracerTimer: 0,
    flash: null,
    flashTimer: 0,
    lastDamageAt: -99,
  };
}

/** Fire one shot. `hitTest` is the world's raycast: it returns the closest hit
 *  { kind: 'ped'|'cop'|'car'|'wall', target, distance } or null. Returns what
 *  was hit, so the caller can raise the wanted level and play the effects. */
export function fireShot(combat, scene, origin, direction, hitTest) {
  if (combat.cooldown > 0) return null;
  combat.cooldown = 0.18;
  const hit = hitTest(origin, direction, 90);
  const end = hit
    ? { x: origin.x + direction.x * hit.distance, y: origin.y + direction.y * hit.distance, z: origin.z + direction.z * hit.distance }
    : { x: origin.x + direction.x * 90, y: origin.y + direction.y * 90, z: origin.z + direction.z * 90 };
  // Tracer: a short-lived bright line from muzzle to impact.
  if (!combat.tracer) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    combat.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    combat.tracer.frustumCulled = false;
    scene.add(combat.tracer);
  }
  const pos = combat.tracer.geometry.attributes.position.array;
  pos[0] = origin.x;
  pos[1] = origin.y;
  pos[2] = origin.z;
  pos[3] = end.x;
  pos[4] = end.y;
  pos[5] = end.z;
  combat.tracer.geometry.attributes.position.needsUpdate = true;
  combat.tracer.visible = true;
  combat.tracerTimer = 0.07;
  if (!combat.flash) {
    combat.flash = new THREE.PointLight(0xffd98a, 0, 18);
    scene.add(combat.flash);
  }
  combat.flash.position.set(origin.x, origin.y, origin.z);
  combat.flash.intensity = 3;
  combat.flashTimer = 0.05;
  return hit;
}

export function stepCombat(combat, dt) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0 && combat.tracer) combat.tracer.visible = false;
  }
  if (combat.flashTimer > 0) {
    combat.flashTimer -= dt;
    if (combat.flashTimer <= 0 && combat.flash) combat.flash.intensity = 0;
  }
}

/** Regenerate health after 6 quiet seconds; returns the new health. */
export function regenHealth(health, now, lastDamageAt, dt) {
  if (health <= 0 || health >= PLAYER.health) return health;
  if (now - lastDamageAt < 6) return health;
  return Math.min(PLAYER.health, health + 5 * dt);
}
