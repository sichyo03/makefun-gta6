// The world: the one object that holds everything — the city, the player, the
// cars, the pedestrians, the police, the wanted level, the cash and the missions
// — and advances it all one fixed step. Screens, drawing and the HUD live in
// other modules; this one only simulates, and reports what happened as events.

import { CAR, CITY, PLAYER, WANTED } from './config.js';
import { createCity, collideCircle } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import {
  createCar,
  createParkedCars,
  createTraffic,
  createPoliceCar,
  driveCar,
  steerToward,
  stepTraffic,
  stepPolice,
} from './vehicles.js';
import { createPedestrians, stepPedestrians, knockDown } from './pedestrians.js';
import { createCombat, fireShot, stepCombat, regenHealth } from './combat.js';
import { createMissions, startMission, currentDialogue, advanceDialogue, stepMissions, PLACES } from './missions.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_STORY = 8;

function createCopMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: '#c98d64' });
  const uniform = new THREE.MeshLambertMaterial({ color: '#1c2733' });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.34), uniform);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.66;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42), uniform);
  cap.position.y = 1.9;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.26), uniform);
  legL.position.set(-0.15, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.26), uniform);
  legR.position.set(0.15, 0.36, 0);
  group.add(legR);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR };
}

export function createWorld(random, scene) {
  const city = createCity(random);
  scene.add(city.group);
  const player = createPlayer(-32, -64);
  player.onFoot = true;
  player.car = null;
  player.armed = true;
  player.lastDamageAt = -99;
  scene.add(player.mesh.group);

  const cars = [];
  for (const car of createParkedCars(random, city)) {
    cars.push(car);
    scene.add(car.mesh.group);
  }
  for (const car of createTraffic(random, city)) {
    cars.push(car);
    scene.add(car.mesh.group);
  }
  // The getaway car for mission 2: a red sports car on Coral Avenue.
  const getaway = createCar(PLACES.getaway.x, PLACES.getaway.z, 0, '#c0392b', 'parked');
  getaway.maxSpeed = 46;
  cars.push(getaway);
  scene.add(getaway.mesh.group);

  const peds = createPedestrians(random, city);
  for (const ped of peds) scene.add(ped.mesh.group);
  // Mama Rosa waits by the cafe: pink shirt, unmistakable.
  const rosa = peds[0];
  rosa.x = PLACES.cafe.x + 2;
  rosa.z = PLACES.cafe.z + 2;
  rosa.state = 'walk';
  rosa.waitTimer = 9999;
  rosa.mesh.shirt.color.set('#e85a9a');

  const pickups = [];
  const pickupGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  for (let i = 0; i < 12; i += 1) {
    const street = pick(random, CITY.streets);
    const along = range(random, -224, 224);
    const onX = random() < 0.5;
    const x = onX ? along : street + 9.5;
    const z = onX ? street + 9.5 : along;
    const mesh = new THREE.Mesh(pickupGeo, new THREE.MeshBasicMaterial({ color: '#37d67a' }));
    mesh.position.set(x, 0.8, z);
    scene.add(mesh);
    pickups.push({ x, z, amount: 100 + Math.floor(random() * 3) * 100, mesh, taken: false, timer: 0 });
  }

  const missions = createMissions();
  startMission(missions, 0);

  return {
    random,
    scene,
    city,
    player,
    cars,
    peds,
    cops: [],
    pickups,
    missions,
    combat: createCombat(),
    wanted: 0,
    lastCrimeAt: -99,
    decayTimer: 0,
    cash: 250,
    time: 0,
    threat: { active: false, x: 0, z: 0 },
    crashSoundAt: -99,
    rosa,
    getaway,
  };
}

/** Reset the world for a fresh game (same seed gives the same city). */
export function resetWorld(world, seed) {
  const scene = world.scene;
  for (const car of world.cars) scene.remove(car.mesh.group);
  for (const ped of world.peds) scene.remove(ped.mesh.group);
  for (const cop of world.cops) scene.remove(cop.mesh.group);
  for (const pickup of world.pickups) scene.remove(pickup.mesh);
  scene.remove(world.player.mesh.group);
  scene.remove(world.city.group);
  const fresh = createWorld(world.random, scene);
  Object.keys(fresh).forEach((key) => {
    world[key] = fresh[key];
  });
  world.player.x = -32;
  world.player.z = -64;
  world.player.mesh.group.position.set(-32, 0, -64);
}

/** Raise the wanted level by n stars (capped) and note the time of the crime. */
export function addWanted(world, n) {
  world.wanted = Math.min(WANTED.max, world.wanted + n);
  world.lastCrimeAt = world.time;
  world.decayTimer = 0;
}

function nearestCar(world, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.dead || car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** The world's raycast for shooting: march along the ray, test circles and boxes. */
export function raycast(world, origin, direction, maxDist) {
  let best = null;
  const steps = Math.floor(maxDist / 0.6);
  for (let i = 1; i <= steps; i += 1) {
    const d = i * 0.6;
    const x = origin.x + direction.x * d;
    const y = origin.y + direction.y * d;
    const z = origin.z + direction.z * d;
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < 0.8 && y > 0 && y < 2.1) {
        if (!best || d < best.distance) best = { kind: 'ped', target: ped, distance: d };
      }
    }
    for (const cop of world.cops) {
      if (cop.health <= 0) continue;
      if (Math.hypot(cop.x - x, cop.z - z) < 0.8 && y > 0 && y < 2.1) {
        if (!best || d < best.distance) best = { kind: 'cop', target: cop, distance: d };
      }
    }
    for (const car of world.cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - x, car.z - z) < 2.4 && y > 0 && y < 1.9) {
        if (!best || d < best.distance) best = { kind: 'car', target: car, distance: d };
      }
    }
    for (const b of world.city.buildings) {
      if (y > b.h) continue;
      if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2) {
        if (!best || d < best.distance) best = { kind: 'wall', target: null, distance: d };
      }
    }
    if (best) return best;
  }
  return best;
}

function spawnPolice(world) {
  const want = WANTED.policeCars[world.wanted] || 0;
  const have = world.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  for (let i = have; i < want; i += 1) {
    const street = pick(world.random, CITY.streets);
    const along = range(world.random, -224, 224);
    const onX = world.random() < 0.5;
    let x = onX ? along : street;
    let z = onX ? street : along;
    // Spawn on a street 60-100m from the player.
    let tries = 0;
    while (Math.hypot(x - world.player.x, z - world.player.z) < 60 && tries < 8) {
      const s2 = pick(world.random, CITY.streets);
      const a2 = range(world.random, -224, 224);
      x = world.random() < 0.5 ? a2 : s2;
      z = world.random() < 0.5 ? s2 : a2;
      tries += 1;
    }
    const car = createPoliceCar(x, z, 0);
    world.cars.push(car);
    world.scene.add(car.mesh.group);
  }
  // Despawn police that are far away or no longer wanted.
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.kind !== 'police') continue;
    const d = Math.hypot(car.x - world.player.x, car.z - world.player.z);
    if (world.wanted === 0 || d > 260) {
      world.scene.remove(car.mesh.group);
      world.cars.splice(i, 1);
    }
  }
}

function stepCops(world, dt, audio) {
  const p = world.player;
  const want = world.wanted;
  // A nearby police car drops a cop on foot when the player is on foot.
  if (want >= 2 && p.onFoot && world.cops.length < 2) {
    for (const car of world.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < 25) {
        const mesh = createCopMesh();
        mesh.group.position.set(car.x + 2, 0, car.z + 2);
        world.scene.add(mesh.group);
        world.cops.push({ mesh, x: car.x + 2, z: car.z + 2, yaw: 0, health: 100, arrestTimer: 0, shootTimer: 1, phase: 0 });
        break;
      }
    }
  }
  for (let i = world.cops.length - 1; i >= 0; i -= 1) {
    const cop = world.cops[i];
    if (cop.health <= 0) {
      cop.mesh.group.rotation.x = Math.min(Math.PI / 2, cop.mesh.group.rotation.x + dt * 4);
      continue;
    }
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    cop.yaw = Math.atan2(dx, dz);
    if (d > 1.6) {
      const speed = want >= 3 ? 6.5 : 5;
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
      cop.phase += dt * 8;
    } else if (p.onFoot) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer >= WANTED.bustTime) return 'busted';
    }
    if (want >= 3 && d < 45 && d > 3) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 1.2;
        if (world.random() < 0.4) {
          p.health -= 6;
          p.lastDamageAt = world.time;
        }
      }
    }
    const pushed = collideCircle(world.city, cop.x, cop.z, 0.5);
    cop.x = pushed.x;
    cop.z = pushed.z;
    const swing = Math.sin(cop.phase) * 0.5;
    cop.mesh.legL.rotation.x = swing;
    cop.mesh.legR.rotation.x = -swing;
    cop.mesh.group.position.set(cop.x, 0, cop.z);
    cop.mesh.group.rotation.y = cop.yaw;
  }
  return null;
}

function stepCarCollisions(world, dt, audio) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.4 || d < 0.01) continue;
      const push = (4.4 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      const rel = Math.abs(a.speed - b.speed);
      // Impact damage only on a fresh hit, not every step of a long shove:
      // a pile-up would otherwise melt the player's health in a second.
      if (rel > 8 && world.time - Math.max(a.lastImpactAt, b.lastImpactAt) > 0.5) {
        a.lastImpactAt = world.time;
        b.lastImpactAt = world.time;
        a.health -= rel * 0.4;
        b.health -= rel * 0.4;
        if (world.time - world.crashSoundAt > 0.5) {
          world.crashSoundAt = world.time;
          audio.crash();
        }
        if (a === world.player.car || b === world.player.car) {
          world.player.health -= rel * 0.25;
          world.player.lastDamageAt = world.time;
        }
      }
    }
  }
  // Cars that hit pedestrians knock them down.
  const p = world.player;
  for (const car of cars) {
    if (car.dead || Math.abs(car.speed) < 5) continue;
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.6) {
        knockDown(ped);
        if (car === p.car) addWanted(world, 1);
        world.threat = { active: true, x: car.x, z: car.z };
      }
    }
    // A speeding car that clips the player on foot hurts.
    if (p.onFoot && Math.hypot(p.x - car.x, p.z - car.z) < 1.8) {
      p.health -= 18;
      p.lastDamageAt = world.time;
      p.x += (p.x - car.x) * 1.5;
      p.z += (p.z - car.z) * 1.5;
      if (car.kind === 'police') addWanted(world, 0);
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.speed = 0;
    }
  }
}

/**
 * One fixed step of the whole simulation. `input` is the input module's state
 * ({ move(), takeDrag(), takeActions() }) and `camera` is the renderer's camera
 * (for the shot direction). Returns an event bitmask (EVENT_*), 0 when nothing.
 */
export function stepWorld(world, input, camera, audio, dt) {
  const p = world.player;
  world.time += dt;
  let events = 0;

  // Dialogue freezes the simulation; confirm/enter/shoot advances it.
  if (currentDialogue(world.missions)) {
    const actions = input.takeActions();
    if (actions) {
      audio.unlock();
      advanceDialogue(world.missions);
    }
    input.takeDrag();
    return 0;
  }

  const drag = input.takeDrag();
  p.camYaw -= drag.x * 0.005;
  p.camPitch = Math.max(0.08, Math.min(0.9, p.camPitch + drag.y * 0.003));
  const actions = input.takeActions();
  const move = input.move();
  if (actions) audio.unlock();

  if (actions & 16) audio.toggleMute();

  if (p.onFoot) {
    stepPlayer(p, world.city, move, dt);
    if (actions & 4) {
      const car = nearestCar(world, p.x, p.z, 4.5);
      if (car) {
        p.car = car;
        p.onFoot = false;
        car.driver = false;
        if (!car.stolen) {
          // Taking a car that is not yours is a theft: the police notice.
          car.stolen = true;
          addWanted(world, 1);
        }
        p.camYaw = car.yaw + Math.PI;
        audio.setEngine(0.1);
      }
    }
    if (actions & 8 && p.armed) {
      const origin = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit = fireShot(world.combat, world.scene, origin, { x: dir.x, y: dir.y, z: dir.z }, (o, d, m) => raycast(world, o, d, m));
      if (hit) {
        audio.gunshot();
        world.threat = { active: true, x: origin.x + dir.x * hit.distance, z: origin.z + dir.z * hit.distance };
        if (hit.kind === 'ped') {
          knockDown(hit.target);
          addWanted(world, 1);
        } else if (hit.kind === 'cop') {
          hit.target.health -= 34;
          addWanted(world, 1);
        } else if (hit.kind === 'car') {
          hit.target.health -= 25;
          if (hit.target.health <= 0) hit.target.dead = true;
        }
      } else {
        audio.gunshot();
      }
    }
  } else if (p.car) {
    const car = p.car;
    // The player rides with the car: position and camera follow it.
    p.x = car.x;
    p.z = car.z;
    // Camera swings behind the car.
    const targetCamYaw = car.yaw + Math.PI;
    let dy = targetCamYaw - p.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.camYaw += dy * Math.min(1, dt * 3);
    driveCar(car, world.city, move.fwd, move.strafe, dt);
    if (actions & 4) {
      // Step out beside the car.
      p.x = car.x + Math.cos(car.yaw) * 2.6;
      p.z = car.z - Math.sin(car.yaw) * 2.6;
      p.yaw = car.yaw;
      p.onFoot = true;
      p.car = null;
      car.kind = 'parked';
      audio.setEngine(0);
    }
  }

  // Traffic and police.
  for (const car of world.cars) {
    if (car.dead) continue;
    if (car.kind === 'traffic' && car !== p.car) stepTraffic(car, world.cars, world.city, dt);
    else if (car.kind === 'police') stepPolice(car, p.x, p.z, world.city, dt);
  }
  spawnPolice(world);

  // A police car ramming the player's car damages it.
  if (p.car) {
    for (const car of world.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = Math.hypot(car.x - p.car.x, car.z - p.car.z);
      if (d < 3.4 && Math.abs(car.speed) > 4) {
        p.car.health -= 12 * dt;
        p.health -= 3 * dt;
        p.lastDamageAt = world.time;
        if (world.time - world.crashSoundAt > 0.6) {
          world.crashSoundAt = world.time;
          audio.crash();
        }
      }
    }
    if (p.car.health <= 0) {
      p.car.dead = true;
      p.car.speed = 0;
    }
  }

  stepCarCollisions(world, dt, audio);
  stepPedestrians(world.peds, world.city, world.threat, dt, world.random);
  world.threat.active = false;
  const copEvent = stepCops(world, dt, audio);
  if (copEvent === 'busted') {
    audio.busted();
    return EVENT_BUSTED;
  }

  // Pickups: spin, collect, respawn after a minute.
  for (const pickup of world.pickups) {
    if (pickup.taken) {
      pickup.timer -= dt;
      if (pickup.timer <= 0) {
        pickup.taken = false;
        pickup.mesh.visible = true;
      }
      continue;
    }
    pickup.mesh.rotation.y += dt * 2;
    pickup.mesh.position.y = 0.8 + Math.sin(world.time * 3) * 0.15;
    if (Math.hypot(p.x - pickup.x, p.z - pickup.z) < 2.6) {
      pickup.taken = true;
      pickup.timer = 60;
      pickup.mesh.visible = false;
      world.cash += pickup.amount;
      audio.pickup();
    }
  }

  // Wanted decay: quiet for a while and no police near, and the heat fades.
  if (world.wanted > 0 && world.time - world.lastCrimeAt > WANTED.decayDelay) {
    let policeNear = false;
    for (const car of world.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.z - p.z) < 60) policeNear = true;
    }
    if (!policeNear && world.cops.length === 0) {
      world.decayTimer += dt;
      if (world.decayTimer >= WANTED.decayInterval) {
        world.decayTimer = 0;
        world.wanted -= 1;
      }
    }
  }

  const missionEvent = stepMissions(world.missions, world);
  if (missionEvent === 'mission') {
    audio.missionDone();
    events |= EVENT_MISSION;
  } else if (missionEvent === 'story') {
    audio.missionDone();
    events |= EVENT_STORY;
  }

  p.health = regenHealth(p.health, world.time, p.lastDamageAt, dt);
  stepCombat(world.combat, dt);

  // Audio follows the car and the sirens.
  const speed01 = p.car ? Math.min(1, Math.abs(p.car.speed) / 40) : 0;
  audio.setEngine(speed01);
  let siren = false;
  for (const car of world.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - p.x, car.z - p.z) < 90) siren = true;
  }
  audio.setSiren(siren);

  if (p.health <= 0) {
    events |= EVENT_WASTED;
  }
  return events;
}

/** Put the player back on their feet at the hospital after a bust or a waste. */
export function respawn(world) {
  const p = world.player;
  if (p.car) {
    p.car = null;
  }
  p.onFoot = true;
  p.x = PLACES.hospital.x;
  p.z = PLACES.hospital.z;
  p.yaw = 0;
  p.health = PLAYER.health;
  p.lastDamageAt = world.time;
  world.wanted = 0;
  world.cash = Math.max(0, world.cash - 500);
  for (const cop of world.cops) world.scene.remove(cop.mesh.group);
  world.cops = [];
  p.mesh.group.position.set(p.x, 0, p.z);
}
