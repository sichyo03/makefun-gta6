// Solmar Bay v2 — the four screenshot scenes behind ?shot=cover|street|
// mission|pursuit. Each stages the real game (a real car, real police, a
// real mission) and drives it forward with a scripted driver, so every
// frame is what the game itself looks like; the same seed gives the same
// frame.
import { makeVehicle, placeOnRoad } from './vehicles.js';

const STEP = 1 / 60;

function putPlayerInCar(world, kind, x, z, heading) {
  const v = makeVehicle(world.scene, kind, x, z, heading);
  v.driver = 'player';
  world.vehicles.push(v);
  const p = world.player;
  p.vehicle = v;
  p.onFoot = false;
  p.mesh.visible = false;
  return v;
}

function addChasers(world, n, dist) {
  const p = world.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const pz = p.vehicle ? p.vehicle.z : p.z;
  for (let i = 0; i < n; i += 1) {
    const a = Math.PI + (i - (n - 1) / 2) * 0.5;
    const v = makeVehicle(world.scene, 'police', px + Math.sin(a) * dist, pz + Math.cos(a) * dist, a + Math.PI);
    v.driver = 'police';
    world.police.cars.push(v);
  }
}

// Two police cars parked across the road ahead of the player.
function placeRoadblock(world, x, z) {
  for (const [dz, heading] of [[-2.6, 0], [2.6, Math.PI]]) {
    const v = makeVehicle(world.scene, 'police', x, z + dz, heading);
    v.driver = 'roadblock';
    world.vehicles.push(v);
  }
}

/**
 * Stage a scene: set the world up, then return how many fixed steps the
 * runner should play forward with the scripted driver before the shot.
 */
export function stageShot(name, world, script) {
  const w = world;
  script.ax = { x: 0, y: 0 };
  script.fire = false;
  if (name === 'street') {
    w.dayTime = 0.18; // morning sun
    // South of the cafe, on open ground, facing north toward Mama Rosa.
    w.player.x = w.city.markers.cafe.x;
    w.player.z = w.city.markers.cafe.z + 24;
    w.player.heading = Math.PI;
    w.player.mesh.position.set(w.player.x, 0, w.player.z);
    w.missions.state.dialogue.push({ who: 'Mama Rosa', text: 'Dario! My best runner is back. Come, I have work for you.' });
    w.audio.ensure();
    return { steps: 150, screen: 'play' };
  }
  if (name === 'mission') {
    w.dayTime = 0.3;
    const rs = w.city.markers.raceStart;
    const car = putPlayerInCar(w, 'sport', rs.x, rs.z, Math.PI / 2);
    car.speed = 12;
    w.missions.startMission(4); // Street King
    script.ax = { x: 0, y: 1 };
    return { steps: 420, screen: 'play' };
  }
  if (name === 'pursuit') {
    w.dayTime = 0.78; // night, lamps on
    const car = putPlayerInCar(w, 'sport', -60, 138, Math.PI / 2);
    car.speed = 26;
    w.police.heat = 4;
    w.police.wanted = 4;
    w.police.blockTimer = 0;
    addChasers(w, 3, 34);
    script.ax = { x: 0, y: 1 };
    return { steps: 180, screen: 'play' };
  }
  // cover (default): dusk chase, 3 stars, chasers behind and a roadblock ahead.
  w.dayTime = 0.52; // dusk
  const car = putPlayerInCar(w, 'sport', -150, 0, Math.PI / 2);
  car.speed = 24;
  w.police.heat = 3;
  w.police.wanted = 3;
  w.police.blockTimer = 999; // the manual roadblock below is the one in frame
  placeRoadblock(w, -70, 0);
  addChasers(w, 2, 30);
  script.ax = { x: 0, y: 1 };
  return { steps: 300, screen: 'play' };
}
