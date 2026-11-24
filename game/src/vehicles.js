// Solmar Bay v2 — vehicles: six distinct car models, a motorcycle and a
// boat, built from boxes with their own silhouettes and colours, plus the
// traffic that drives them around the road grid.
import { WORLD, CAR } from './config.js';
import { range, pick } from './random.js';

const THREE = window.THREE;

export const VEHICLE_DEFS = {
  compact: { name: 'Corto', topSpeed: 30, accel: 15, turn: 2.4, color: 0xd8a03a, len: 3.4, wid: 1.7, h: 1.25 },
  sedan: { name: 'Vento', topSpeed: 34, accel: 16, turn: 2.1, color: 0x3a6bd8, len: 4.2, wid: 1.9, h: 1.35 },
  sport: { name: 'Largo', topSpeed: 40, accel: 19, turn: 2.5, color: 0xd83a3a, len: 4.4, wid: 2.0, h: 1.1 },
  truck: { name: 'Bison', topSpeed: 27, accel: 12, turn: 1.7, color: 0x5a6b3a, len: 5.2, wid: 2.2, h: 2.2 },
  taxi: { name: 'Taxi', topSpeed: 34, accel: 16, turn: 2.1, color: 0xe8c81a, len: 4.2, wid: 1.9, h: 1.35 },
  police: { name: 'Patrol', topSpeed: 37, accel: 18, turn: 2.4, color: 0x1a1a22, len: 4.4, wid: 2.0, h: 1.4 },
  bike: { name: 'Falco', topSpeed: 42, accel: 22, turn: 3.0, color: 0x8a2be2, len: 2.2, wid: 0.8, h: 1.1 },
  boat: { name: 'Marlin', topSpeed: 30, accel: 13, turn: 1.6, color: 0xe8e8e8, len: 7.5, wid: 2.6, h: 1.6 },
};

const TRAFFIC_KINDS = ['compact', 'sedan', 'sport', 'truck', 'taxi'];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

function wheel(x, z, r = 0.42) {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.32, 10),
    new THREE.MeshLambertMaterial({ color: 0x141414 }),
  );
  w.rotation.z = Math.PI / 2;
  w.position.set(x, r, z);
  return w;
}

/** Build a vehicle mesh for a kind. Returns a THREE.Group facing +Z. */
export function buildVehicleMesh(kind) {
  const def = VEHICLE_DEFS[kind];
  const g = new THREE.Group();
  const L = def.len;
  const W = def.wid;
  if (kind === 'bike') {
    g.add(box(0.5, 0.5, 1.9, def.color, 0, 0.75, 0));
    g.add(box(0.4, 0.7, 0.7, 0x222222, 0, 1.15, -0.3));
    const f = wheel(0, 0.85, 0.36);
    const b = wheel(0, -0.85, 0.36);
    f.position.y = 0.36;
    b.position.y = 0.36;
    g.add(f);
    g.add(b);
    g.add(box(0.08, 0.5, 0.08, 0x888888, 0, 1.2, 0.75)); // handlebar post
    return g;
  }
  if (kind === 'boat') {
    const hull = box(W, 1.0, L, def.color, 0, 0.8, 0);
    g.add(hull);
    g.add(box(W * 0.8, 0.9, L * 0.45, 0x2a4a6b, 0, 1.7, -0.6)); // cabin
    g.add(box(0.3, 1.2, 0.3, 0xcccccc, 0, 2.4, -1.2)); // mast
    g.add(box(W * 0.9, 0.15, L * 0.2, 0xd8d8d8, 0, 1.35, 1.6)); // bow deck
    return g;
  }
  // Body and cabin.
  g.add(box(W, def.h * 0.55, L, def.color, 0, def.h * 0.32, 0));
  const cabinH = def.h * 0.5;
  const cabin = box(W * 0.86, cabinH, L * (kind === 'truck' ? 0.34 : 0.52), 0x18242e, 0, def.h * 0.6 + cabinH * 0.4, kind === 'truck' ? L * 0.22 : -L * 0.06);
  g.add(cabin);
  if (kind === 'truck') {
    g.add(box(W * 0.95, def.h * 0.9, L * 0.5, 0x7a7a72, 0, def.h * 0.55, -L * 0.2)); // cargo box
  }
  // Wheels.
  const wz = L * 0.32;
  const wx = W / 2;
  g.add(wheel(wx, wz));
  g.add(wheel(-wx, wz));
  g.add(wheel(wx, -wz));
  g.add(wheel(-wx, -wz));
  // Lights.
  g.add(box(0.4, 0.22, 0.1, 0xfff2b0, -W * 0.3, def.h * 0.32, L / 2));
  g.add(box(0.4, 0.22, 0.1, 0xfff2b0, W * 0.3, def.h * 0.32, L / 2));
  g.add(box(0.4, 0.22, 0.1, 0xd83a3a, -W * 0.3, def.h * 0.32, -L / 2));
  g.add(box(0.4, 0.22, 0.1, 0xd83a3a, W * 0.3, def.h * 0.32, -L / 2));
  if (kind === 'taxi') {
    g.add(box(0.9, 0.3, 0.5, 0x222222, 0, def.h * 0.6 + cabinH + 0.15, 0)); // roof sign
  }
  if (kind === 'police') {
    g.add(box(W * 0.7, 0.3, 0.7, 0xffffff, 0, def.h * 0.6 + cabinH * 0.5, 0)); // white doors band
    const bar = box(1.1, 0.22, 0.4, 0x2244ff, 0, def.h * 0.6 + cabinH + 0.1, 0);
    g.add(bar);
    const bar2 = box(0.5, 0.24, 0.42, 0xff2222, -0.55, def.h * 0.6 + cabinH + 0.1, 0);
    g.add(bar2);
  }
  return g;
}

/** A vehicle record: mesh + driving state. */
export function makeVehicle(scene, kind, x, z, heading) {
  const def = VEHICLE_DEFS[kind];
  const mesh = buildVehicleMesh(kind);
  mesh.position.set(x, kind === 'boat' ? WORLD.waterLevel : 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    kind, def, mesh,
    x, z, heading,
    speed: 0,
    driver: null, // null | 'player' | 'traffic' | 'police'
    health: 100,
    // traffic brain
    lane: null, // {axis:'x'|'z', line, dir}
    stuck: 0,
  };
}

/** Put a traffic car on a random road lane. */
export function placeOnRoad(vehicle, rng) {
  const pitch = WORLD.blockPitch;
  const half = WORLD.half;
  const axis = rng() < 0.5 ? 'x' : 'z';
  const line = -half + Math.floor(rng() * (WORLD.blocks + 1)) * pitch - pitch / 2 + WORLD.blockSize / 2 + WORLD.roadWidth / 2;
  const along = range(rng, -half + 10, half - 10);
  const dir = rng() < 0.5 ? 1 : -1;
  const laneOff = 2.2 * dir;
  if (axis === 'x') {
    vehicle.x = along;
    vehicle.z = line + laneOff;
    vehicle.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    vehicle.x = line + laneOff;
    vehicle.z = along;
    vehicle.heading = dir > 0 ? 0 : Math.PI;
  }
  vehicle.lane = { axis, line: line + laneOff, dir };
  vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
  vehicle.mesh.rotation.y = vehicle.heading;
}

/** Drive one traffic car along its lane; turn at intersections sometimes. */
export function updateTrafficCar(v, dt, rng, others) {
  if (!v.lane) return;
  const target = v.def.topSpeed * 0.55;
  v.speed += (target - v.speed) * Math.min(1, dt * 0.8);
  // Slow for a car ahead on the same lane.
  for (const o of others) {
    if (o === v || !o.lane || o.lane.axis !== v.lane.axis || Math.abs(o.lane.line - v.lane.line) > 3) continue;
    const along = v.lane.axis === 'x' ? o.x - v.x : o.z - v.z;
    const ahead = v.lane.dir > 0 ? along : -along;
    if (ahead > 0 && ahead < 9) v.speed = Math.min(v.speed, Math.max(0, o.speed * 0.8));
  }
  const step = v.speed * v.lane.dir * dt;
  if (v.lane.axis === 'x') v.x += step;
  else v.z += step;
  // Wrap at the city edge; sometimes pick a new lane at an intersection.
  const half = WORLD.half;
  const over = v.lane.axis === 'x' ? Math.abs(v.x) > half + 6 : Math.abs(v.z) > half + 6;
  if (over) {
    placeOnRoad(v, rng);
    return;
  }
  // Random turn at an intersection.
  const pitch = WORLD.blockPitch;
  const pos = v.lane.axis === 'x' ? v.x : v.z;
  const nearLine = Math.abs(((pos + half) % pitch) - pitch / 2) < v.speed * dt + 1.2;
  if (nearLine && rng() < dt * 0.25) {
    placeOnRoad(v, rng);
    return;
  }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
}
