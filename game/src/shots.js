// The screenshot scenes behind ?shot=cover|street|mission|chase. Each one stages
// the real world — a driving chase, a street on foot, a mission moment, a police
// pursuit — lets it settle for a second and a half, and paints it, so the frame
// is what a short game really looks like. The same seed always gives the same
// frame. The HUD paints over it exactly as it does in play.

import { STEP } from './config.js';
import { createPoliceCar } from './vehicles.js';
import { startMission, PLACES } from './missions.js';
import { stepWorld } from './world.js';

const SETTLE_STEPS = 90;

function dummyInput() {
  return {
    move() {
      return { fwd: 0, strafe: 0, run: false };
    },
    takeDrag() {
      return { x: 0, y: 0 };
    },
    takeActions() {
      return 0;
    },
  };
}

const silentAudio = {
  unlock() {},
  toggleMute() {},
  setEngine() {},
  setSiren() {},
  gunshot() {},
  pickup() {},
  crash() {},
  missionDone() {},
  busted() {},
};

function clearPolice(world) {
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.kind === 'police') {
      world.scene.remove(car.mesh.group);
      world.cars.splice(i, 1);
    }
  }
}

function addPolice(world, x, z, yaw) {
  const car = createPoliceCar(x, z, yaw);
  car.speed = 20;
  world.cars.push(car);
  world.scene.add(car.mesh.group);
  return car;
}

function putPlayerInCar(world, car, x, z, yaw, speed) {
  car.x = x;
  car.z = z;
  car.yaw = yaw;
  car.speed = speed;
  car.mesh.group.position.set(x, 0, z);
  car.mesh.group.rotation.y = yaw;
  const p = world.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.z = z;
  p.camYaw = yaw + Math.PI;
  p.camPitch = 0.3;
  p.camDist = 9;
}

function putPlayerOnFoot(world, x, z, yaw, camYaw) {
  const p = world.player;
  if (p.car) {
    p.car = null;
  }
  p.onFoot = true;
  p.x = x;
  p.z = z;
  p.yaw = yaw;
  p.camYaw = camYaw;
  p.camPitch = 0.3;
  p.camDist = 9;
  p.mesh.group.position.set(x, 0, z);
  p.mesh.group.rotation.y = yaw;
}

function settle(world, renderer, audio) {
  // Dialogue freezes the simulation, so park it while the scene settles and
  // put it back for the frame: the traffic, the police and the car must move.
  const savedDialogue = world.missions.dialogue;
  const savedLine = world.missions.dialogueLine;
  world.missions.dialogue = null;
  const input = dummyInput();
  for (let i = 0; i < SETTLE_STEPS; i += 1) {
    stepWorld(world, input, renderer.camera, audio, STEP);
  }
  world.missions.dialogue = savedDialogue;
  world.missions.dialogueLine = savedLine;
  renderer.snapCamera(world);
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * Any other name is the cover.
 */
export function stageShot(name, world, renderer) {
  const scene = name === 'street' || name === 'mission' || name === 'chase' ? name : 'cover';
  clearPolice(world);
  if (scene === 'cover') {
    startMission(world.missions, 3);
    world.wanted = 3;
    world.lastCrimeAt = world.time;
    // Northbound on the Coral Avenue street, police closing in behind and
    // one more coming head-on up ahead.
    putPlayerInCar(world, world.getaway, -32, 160, Math.PI, 22);
    addPolice(world, -38, 205, Math.PI);
    addPolice(world, -26, 95, 0);
    settle(world, renderer, silentAudio);
    world.getaway.speed = 24;
    world.player.camYaw = world.getaway.yaw + Math.PI;
    // The cover shows the chase, not the conversation: hide the dialogue box.
    world.missions.dialogue = null;
  } else if (scene === 'street') {
    startMission(world.missions, 0);
    world.wanted = 0;
    putPlayerOnFoot(world, -32, -24, Math.PI, Math.PI);
    world.player.armed = false;
    settle(world, renderer, silentAudio);
  } else if (scene === 'mission') {
    startMission(world.missions, 0);
    world.wanted = 0;
    putPlayerOnFoot(world, PLACES.cafe.x + 6, PLACES.cafe.z + 8, Math.PI * 0.75, Math.PI * 0.85);
    world.player.armed = false;
    // Rosa stands just beyond Dario, in the open, so the frame shows them both.
    world.rosa.x = PLACES.cafe.x + 2;
    world.rosa.z = PLACES.cafe.z + 14;
    world.rosa.mesh.group.position.set(world.rosa.x, 0, world.rosa.z);
    settle(world, renderer, silentAudio);
  } else {
    startMission(world.missions, 3);
    world.wanted = 4;
    world.lastCrimeAt = world.time;
    // Eastbound on the Palm Row street, a patrol on the tail and one
    // alongside, ramming. The docks are the objective, far ahead.
    putPlayerInCar(world, world.getaway, 0, -32, Math.PI / 2, 26);
    addPolice(world, -45, -32, Math.PI / 2);
    addPolice(world, 30, -24, Math.PI / 2);
    addPolice(world, 60, -40, Math.PI / 2);
    settle(world, renderer, silentAudio);
    world.getaway.speed = 28;
    world.player.camYaw = world.getaway.yaw + Math.PI;
    world.missions.dialogue = null;
  }
  renderer.snapCamera(world);
  return { screen: 'play' };
}
