// Solmar Bay v2 — the world: one object holding every system and the frame
// update that drives them. Player, traffic, police, missions, peds, combat,
// day/night, saving and the camera target all meet here.
import { WORLD, PLAYER, CAR, WANTED, WEAPONS, SAVE_KEY, BEST_KEY } from './config.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerOnFoot, collideCircle } from './player.js';
import { makeVehicle, placeOnRoad, updateTrafficCar, VEHICLE_DEFS } from './vehicles.js';
import { createPolice, addHeat, updatePolice } from './police.js';
import { createMissions } from './missions.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createLoadout, giveWeapon, switchWeapon, startReload, fireWeapon, updateCombat, updateTracers } from './combat.js';
import { ACTION_INTERACT, ACTION_RELOAD, ACTION_RADIO, ACTION_CONFIRM } from './input.js';
import { range } from './random.js';

const THREE = window.THREE;

export function createWorld(render, input, hud, audio, rng) {
  const scene = render.scene;
  const city = buildCity(scene, rng);
  const player = createPlayer(scene);
  player.x = city.markers.cafe.x - 12;
  player.z = city.markers.cafe.z + 16;
  player.heading = Math.PI * 0.2;
  player.mesh.position.set(player.x, 0, player.z);

  const police = createPolice(scene, rng);
  const loadout = createLoadout();
  const tracers = [];
  const vehicles = [];
  const peds = createPedestrians(scene, rng, 22);

  // Traffic: 14 cars on the roads; 12 parked cars around the city.
  for (let i = 0; i < 14; i += 1) {
    const kind = ['compact', 'sedan', 'sport', 'truck', 'taxi'][i % 5];
    const v = makeVehicle(scene, kind, 0, 0, 0);
    v.driver = 'traffic';
    placeOnRoad(v, rng);
    vehicles.push(v);
  }
  const parkedKinds = ['compact', 'sedan', 'sport', 'sedan', 'compact', 'truck', 'sedan', 'sport', 'compact', 'sedan', 'taxi', 'sedan'];
  for (let i = 0; i < 12; i += 1) {
    const v = makeVehicle(scene, parkedKinds[i], 0, 0, 0);
    placeOnRoad(v, rng); // parked along a road, never inside a block
    vehicles.push(v);
  }
  // A motorcycle by the beach and the boat at the docks.
  const bike = makeVehicle(scene, 'bike', -60, 236, 0.5);
  vehicles.push(bike);
  const boat = makeVehicle(scene, 'boat', WORLD.dockX + 40, city.markers.docks.z + 2, Math.PI / 2);
  vehicles.push(boat);

  const world = {
    scene, rng, city, player, police, loadout, vehicles, peds,
    weapons: WEAPONS,
    hud, audio, input,
    cash: 200,
    dayTime: 0.3, // morning
    time: 0,
    over: false,
    overKind: null,
    interactPressed: false,
    radioToast: 0,
    missions: null,
    best: 0,
  };
  world.missions = createMissions(world);

  function say(text) {
    hud.showToast(text);
  }
  world.say = say;

  function saveGame() {
    try {
      const data = {
        cash: world.cash,
        missionNext: world.missions.state.next,
        packagesFound: world.missions.state.packagesFound,
        owned: world.loadout.owned,
        ammo: world.loadout.ammo,
        best: world.best,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage can be off */ }
  }
  world.saveGame = saveGame;

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  world.loadSave = loadSave;

  function applySave(data) {
    if (!data) return;
    world.cash = data.cash || 200;
    world.missions.state.next = data.missionNext || 0;
    if (data.owned) {
      for (const k of Object.keys(data.owned)) {
        if (data.owned[k]) giveWeapon(world.loadout, k, 0);
      }
    }
    if (data.ammo) world.loadout.ammo = { ...world.loadout.ammo, ...data.ammo };
    world.best = data.best || 0;
    // Restore found packages.
    const found = data.packagesFound || 0;
    let n = 0;
    for (const pkg of world.missions.state.packages) {
      if (n < found) {
        pkg.found = true;
        scene.remove(pkg.mesh);
        n += 1;
      }
    }
    world.missions.state.packagesFound = found;
  }
  world.applySave = applySave;

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }
  world.best = readBest();

  function consumeInteract() {
    if (world.interactPressed) {
      world.interactPressed = false;
      return true;
    }
    return false;
  }
  world.consumeInteract = consumeInteract;

  function spawnEscortCar(x, z) {
    const v = makeVehicle(scene, 'sedan', x, z, 0);
    v.driver = 'escort';
    v.mesh.children.forEach(() => {});
    vehicles.push(v);
    return v;
  }
  world.spawnEscortCar = spawnEscortCar;

  function removeEscortCar(v) {
    scene.remove(v.mesh);
    const i = vehicles.indexOf(v);
    if (i >= 0) vehicles.splice(i, 1);
  }
  world.removeEscortCar = removeEscortCar;

  function nearestVehicle(x, z, maxDist) {
    let bestV = null;
    let bestD = maxDist;
    for (const v of vehicles) {
      if (v.driver === 'police' || v.driver === 'roadblock' || v.driver === 'escort') continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bestD) {
        bestD = d;
        bestV = v;
      }
    }
    return bestV;
  }

  function enterVehicle(v) {
    player.vehicle = v;
    player.onFoot = false;
    v.driver = 'player';
    v.lane = null;
    player.mesh.visible = false;
    audio.engine(true, 0);
    if (v.kind !== 'boat') addHeat(police, WANTED.stealCar);
    say(v.kind === 'boat' ? `Boarded the ${v.def.name}` : `Stole the ${v.def.name} — wanted +1`);
  }

  function exitVehicle() {
    const v = player.vehicle;
    if (!v) return;
    const sx = v.x - Math.cos(v.heading) * 3.2;
    const sz = v.z + Math.sin(v.heading) * 3.2;
    player.x = sx;
    player.z = sz;
    player.heading = v.heading;
    player.onFoot = true;
    player.vehicle = null;
    v.driver = null;
    v.speed = 0;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    audio.engine(false, 0);
  }

  function damagePlayer(amount, source) {
    if (world.over) return;
    player.health -= amount;
    hud.flash();
    if (player.health <= 0) {
      player.health = 0;
      gameOver('WASTED', 'Dario went down. The Bay keeps the money.');
    }
  }
  world.damagePlayer = damagePlayer;

  function gameOver(title, text) {
    world.over = true;
    world.overKind = title;
    audio.siren(false);
    audio.engine(false, 0);
    if (world.cash > world.best) {
      world.best = world.cash;
      try { window.localStorage.setItem(BEST_KEY, String(world.best)); } catch { /* ignore */ }
    }
    hud.setScreen('over', { title, text: `${text} Cash kept: $${world.cash}.` });
  }
  world.gameOver = gameOver;

  // Callbacks the police and missions call into.
  let ramCd = 0;
  let crashCd = 0;
  world.onRam = (car, dist) => {
    if (player.vehicle) {
      if (ramCd <= 0) {
        ramCd = 0.9;
        damagePlayer(5, 'ram');
        audio.crash();
      }
      player.vehicle.speed *= 0.6;
    } else if (dist < 2.2) {
      if (ramCd <= 0) {
        ramCd = 0.9;
        damagePlayer(14, 'ram');
        audio.crash();
      }
    }
  };
  world.onCopShot = (cop, dist) => {
    if (player.onFoot) damagePlayer(6 + Math.floor(rng() * 5), 'cop');
  };
  world.onCopDown = (cop) => {
    addHeat(police, 0); // killing a cop is already priced by the heat it brings
    giveWeapon(loadout, 'pistol', 12);
    if (rng() < 0.4) giveWeapon(loadout, 'smg', 24);
    world.cash += 25;
  };
  world.onEnemyShot = (e, dist) => {
    if (player.onFoot) damagePlayer(5 + Math.floor(rng() * 5), 'enemy');
    else if (player.vehicle) {
      player.vehicle.health -= 4;
      if (player.vehicle.health <= 0) {
        say('Your car is wrecked!');
        exitVehicle();
      }
    }
  };

  function driveVehicle(v, dt, ax) {
    const def = v.def;
    const isBoat = v.kind === 'boat';
    const maxFwd = def.topSpeed;
    const maxRev = CAR.maxReverse;
    if (ax.y > 0) v.speed += def.accel * dt;
    else if (ax.y < 0) {
      if (v.speed > 0.5) v.speed -= CAR.brake * dt;
      else v.speed -= def.accel * 0.6 * dt;
    } else {
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
    }
    v.speed = Math.max(-maxRev, Math.min(maxFwd, v.speed));
    const steer = ax.x * (v.speed >= 0 ? 1 : -1);
    v.heading += steer * def.turn * dt * Math.min(1, Math.abs(v.speed) / 10 + 0.25);
    const nx = v.x + Math.sin(v.heading) * v.speed * dt;
    const nz = v.z + Math.cos(v.heading) * v.speed * dt;
    if (isBoat) {
      v.x = Math.max(236, Math.min(420, nx));
      v.z = Math.max(-40, Math.min(420, nz));
    } else {
      // Two-circle collision against buildings. A car that grazes a wall
      // slides along it: try the full step, then each axis on its own, so
      // a glancing hit never dead-stops the car.
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const circlesHit = (x, z) => {
        for (const off of [1.4, -1.4]) {
          const cx = x + fx * off;
          const cz = z + fz * off;
          const solved = collideCircle(cx, cz, 1.9, city.colliders);
          if (Math.abs(solved.x - cx) > 0.01 || Math.abs(solved.z - cz) > 0.01) return true;
        }
        return false;
      };
      const clampX = (x) => Math.max(-245, Math.min(245, x));
      const clampZ = (z) => Math.max(-245, Math.min(295, z));
      if (circlesHit(nx, nz)) {
        if (Math.abs(v.speed) > 14 && crashCd <= 0) {
          crashCd = 0.6;
          audio.crash();
          damagePlayer(4, 'crash');
        }
        if (!circlesHit(nx, v.z)) v.x = clampX(nx);
        else if (!circlesHit(v.x, nz)) v.z = clampZ(nz);
        v.speed *= 0.45;
      } else {
        v.x = clampX(nx);
        v.z = clampZ(nz);
      }
      // Soft push against other vehicles.
      for (const o of vehicles) {
        if (o === v || o.driver === 'player') continue;
        const d = Math.hypot(o.x - v.x, o.z - v.z);
        if (d < 4.2 && d > 0.01) {
          const push = (4.2 - d) / 2;
          const px = (v.x - o.x) / d;
          const pz = (v.z - o.z) / d;
          v.x += px * push;
          v.z += pz * push;
          if (Math.abs(v.speed) > 18) audio.crash();
          v.speed *= 0.7;
        }
      }
    }
    const bob = isBoat ? Math.sin(world.time * 1.4) * 0.12 : 0;
    v.mesh.position.set(v.x, (isBoat ? WORLD.waterLevel : 0) + bob, v.z);
    v.mesh.rotation.y = v.heading;
    if (isBoat) v.mesh.rotation.z = Math.sin(world.time * 1.1) * 0.02;
  }

  function update(dt, frameActions = 0) {
    if (world.over) return;
    if (ramCd > 0) ramCd -= dt;
    if (crashCd > 0) crashCd -= dt;
    world.time += dt;
    world.dayTime = (world.dayTime + dt / 240) % 1;
    render.setDayNight(world.dayTime);

    // Actions come from the frame loop, which drains the input once per
    // frame and hands them to the first step — the world never drains the
    // input itself, or a press would be eaten before it got here.
    const actions = frameActions;
    if (actions & ACTION_INTERACT) world.interactPressed = true;
    if (actions & ACTION_RELOAD) startReload(loadout);
    if (actions & ACTION_RADIO) {
      const name = audio.cycleStation();
      say(`Radio: ${name}`);
    }
    const digit = input.takeDigit();
    if (digit >= 1 && digit <= 3) {
      const kind = loadout.order[digit - 1];
      if (switchWeapon(loadout, kind)) say(`Weapon: ${WEAPONS[kind].name}`);
    } else if (digit >= 4 && digit <= 6) {
      say(`Radio: ${audio.setStation(digit - 4)}`);
    }

    const ax = input.axes();
    render.addYaw(input.look() * dt * 2.4);

    // Enter / exit vehicles (not while a dialogue box is open).
    const dialogueOpen = world.missions.state.dialogue.length > 0;
    if (world.interactPressed && !dialogueOpen && player.onFoot) {
      const v = nearestVehicle(player.x, player.z, PLAYER.interactRange);
      if (v) {
        enterVehicle(v);
        world.interactPressed = false;
      }
    } else if (world.interactPressed && !dialogueOpen && !player.onFoot) {
      exitVehicle();
      world.interactPressed = false;
    }

    // Player movement.
    if (player.onFoot) {
      updatePlayerOnFoot(player, dt, input, render.cam.yaw, city.colliders, world);
    } else if (player.vehicle) {
      driveVehicle(player.vehicle, dt, ax);
      // Keep the player's position in sync with the car for anything that
      // reads player.x / player.z directly (police, missions, HUD).
      player.x = player.vehicle.x;
      player.z = player.vehicle.z;
      player.heading = player.vehicle.heading;
    }

    // Combat on foot.
    updateCombat(dt, loadout);
    const canFire = loadout.cooldown <= 0 && loadout.reloading <= 0 && loadout.inMag[loadout.current] > 0;
    if (player.onFoot && input.firing() && !world.missions.state.dialogueOpen && canFire) {
      const cam = render.camera;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const origin = { x: player.x + Math.sin(player.heading) * 0.6, y: 1.5, z: player.z + Math.cos(player.heading) * 0.6 };
      const targets = [];
      for (const cop of police.cops) targets.push(cop);
      for (const e of world.missions.state.enemies) targets.push(e);
      for (const p of peds) {
        if (!p.dead) targets.push(p);
      }
      const hit = fireWeapon(scene, loadout, origin, { x: dir.x, y: dir.y, z: dir.z }, targets, tracers);
      audio.shot(loadout.current);
      if (hit) {
        if (hit.kind === 'ped' && hit.health <= 0) {
          hit.dead = true;
          hit.mesh.rotation.x = Math.PI / 2;
          hit.mesh.position.y = 0.4;
          addHeat(police, WANTED.killPed);
          say('A bystander went down — wanted +1');
        } else if (hit.kind === 'cop' && hit.health <= 0) {
          addHeat(police, WANTED.killCop);
        }
      }
    }
    updateTracers(dt, tracers);

    // Mission start: press E near Mama Rosa when no mission is active.
    if (!world.missions.state.active && world.missions.canStart()) {
      const d = Math.hypot(player.x - city.markers.cafe.x, player.z - city.markers.cafe.z);
      if (d < 12 && world.interactPressed) {
        world.interactPressed = false;
        world.missions.startMission(world.missions.state.next);
      }
    }
    // Dialogue advance.
    if (world.missions.state.dialogue.length > 0) {
      const line = world.missions.state.dialogue[0];
      hud.setDialogue(line);
      if (world.interactPressed) {
        world.interactPressed = false;
        world.missions.state.dialogue.shift();
        if (world.missions.state.dialogue.length === 0) hud.setDialogue(null);
      }
    }
    world.missions.update(dt);

    // Police, traffic, peds.
    updatePolice(police, dt, player, world);
    audio.siren(police.sirenOn);
    audio.engine(!player.onFoot && player.vehicle ? true : false, player.vehicle ? Math.abs(player.vehicle.speed) / 40 : 0);
    for (const v of vehicles) {
      if (v.driver === 'traffic') updateTrafficCar(v, dt, rng, vehicles);
    }
    const pp = player.vehicle ? { x: player.vehicle.x, z: player.vehicle.z } : { x: player.x, z: player.z };
    const danger = police.wanted > 0 || input.firing();
    updatePedestrians(peds, dt, pp, danger);

    // Hideout: heat fades fast inside it.
    const hd = Math.hypot(pp.x - city.markers.hideout.x, pp.z - city.markers.hideout.z);
    if (hd < 14 && police.heat > 0) {
      police.heat = Math.max(0, police.heat - 0.35 * dt);
      police.wanted = Math.round(police.heat);
    }

    // Busted: a cop reaches the player on foot.
    if (player.onFoot && police.wanted > 0) {
      for (const cop of police.cops) {
        if (Math.hypot(cop.x - player.x, cop.z - player.z) < 2.0) {
          gameOver('BUSTED', 'The Bay Police caught Dario.');
          break;
        }
      }
    }

    // Camera.
    const target = player.vehicle
      ? new THREE.Vector3(player.vehicle.x, 1.5, player.vehicle.z)
      : new THREE.Vector3(player.x, 1.5, player.z);
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    const mode = player.vehicle ? (player.vehicle.kind === 'boat' ? 'boat' : 'car') : 'foot';
    render.updateCamera(dt, target, heading, mode);

    hud.update(world, dt);
  }

  return { world, update };
}
