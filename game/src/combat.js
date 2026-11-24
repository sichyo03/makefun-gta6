// Solmar Bay v2 — combat: three weapons (pistol, SMG, shotgun) with ammo,
// reload and distinct feel, hitscan fire with visible tracers, and damage
// numbers. Targets are anything with a position and health in the world.
import { WEAPONS } from './config.js';

const THREE = window.THREE;

export function createLoadout() {
  return {
    order: ['pistol', 'smg', 'shotgun'],
    current: 'pistol',
    ammo: { pistol: 48, smg: 0, shotgun: 0 }, // reserve ammo
    inMag: { pistol: 12, smg: 0, shotgun: 0 },
    reloading: 0,
    cooldown: 0,
    owned: { pistol: true, smg: false, shotgun: false },
  };
}

export function giveWeapon(loadout, kind, ammo) {
  loadout.owned[kind] = true;
  loadout.ammo[kind] = (loadout.ammo[kind] || 0) + ammo;
  if (loadout.inMag[kind] === 0) {
    const take = Math.min(WEAPONS[kind].mag, loadout.ammo[kind]);
    loadout.inMag[kind] = take;
    loadout.ammo[kind] -= take;
  }
}

export function switchWeapon(loadout, kind) {
  if (!loadout.owned[kind] || loadout.current === kind) return false;
  loadout.current = kind;
  loadout.reloading = 0;
  loadout.cooldown = 0.2;
  return true;
}

export function startReload(loadout) {
  const w = WEAPONS[loadout.current];
  if (loadout.reloading > 0) return false;
  if (loadout.inMag[loadout.current] >= w.mag) return false;
  if ((loadout.ammo[loadout.current] || 0) <= 0) return false;
  loadout.reloading = w.reload;
  return true;
}

function finishReload(loadout) {
  const w = WEAPONS[loadout.current];
  const need = w.mag - loadout.inMag[loadout.current];
  const take = Math.min(need, loadout.ammo[loadout.current]);
  loadout.inMag[loadout.current] += take;
  loadout.ammo[loadout.current] -= take;
  loadout.reloading = 0;
}

/**
 * Fire one shot from `origin` along `dir` (both Vector3-ish {x,y,z}).
 * `targets` is a list of {x, z, y?, radius, health, onHit(dmg, kind)}.
 * Returns the hit target (or null) and spawns a tracer in the scene.
 */
export function fireWeapon(scene, loadout, origin, dir, targets, tracers) {
  const kind = loadout.current;
  const w = WEAPONS[kind];
  if (loadout.cooldown > 0 || loadout.reloading > 0) return null;
  if (loadout.inMag[kind] <= 0) {
    startReload(loadout);
    return null;
  }
  loadout.inMag[kind] -= 1;
  loadout.cooldown = w.rate;
  let hit = null;
  let bestT = w.range;
  const dLen = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const dx = dir.x / dLen;
  const dy = dir.y / dLen;
  const dz = dir.z / dLen;
  for (let p = 0; p < w.pellets; p += 1) {
    // Spread per pellet.
    const sx = dx + (Math.random() - 0.5) * w.spread * 2;
    const sy = dy + (Math.random() - 0.5) * w.spread * 2;
    const sz = dz + (Math.random() - 0.5) * w.spread * 2;
    const sl = Math.hypot(sx, sy, sz) || 1;
    const px = sx / sl;
    const py = sy / sl;
    const pz = sz / sl;
    for (const t of targets) {
      if (t.health <= 0) continue;
      const ty = t.y !== undefined ? t.y : 1.2;
      const ox = t.x - origin.x;
      const oy = ty - origin.y;
      const oz = t.z - origin.z;
      const along = ox * px + oy * py + oz * pz;
      if (along < 0 || along > bestT) continue;
      const cx = origin.x + px * along;
      const cy = origin.y + py * along;
      const cz = origin.z + pz * along;
      const dd = Math.hypot(t.x - cx, ty - cy, t.z - cz);
      if (dd < (t.radius || 1.1)) {
        bestT = along;
        hit = t;
      }
    }
    if (hit) {
      hit.health -= w.damage;
      if (hit.onHit) hit.onHit(w.damage, kind);
    }
    // Tracer: a short-lived line from the muzzle to the impact point.
    const end = {
      x: origin.x + px * bestT,
      y: origin.y + py * bestT,
      z: origin.z + pz * bestT,
    };
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(end.x, end.y, end.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }
  if (loadout.inMag[kind] === 0) startReload(loadout);
  return hit;
}

export function updateCombat(dt, loadout) {
  if (loadout.cooldown > 0) loadout.cooldown -= dt;
  if (loadout.reloading > 0) {
    loadout.reloading -= dt;
    if (loadout.reloading <= 0) finishReload(loadout);
  }
}

export function updateTracers(dt, tracers) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    if (t.life <= 0) {
      t.line.parent && t.line.parent.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}
