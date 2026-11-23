// Cars: a box-built body with a cabin, wheels and lights, arcade driving physics
// (accelerate, steer, brake, drift a little), traffic that follows the street
// loops, parked cars on the curbs, and police cars that hunt the player.

import { CAR, CITY } from './config.js';
import { pick, range } from './random.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

const CAR_COLORS = ['#c0392b', '#2e6fb0', '#d8a03c', '#3f8a4a', '#7d5aa8', '#c9c9c9', '#22262b', '#b86a2e'];
const TAXI_COLOR = '#f2c230';

function makeWheel() {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10),
    new THREE.MeshLambertMaterial({ color: '#101214' }),
  );
  wheel.rotation.z = Math.PI / 2;
  wheel.castShadow = true;
  return wheel;
}

/** A car mesh: body, cabin, wheels, headlights and (for police) a light bar. */
export function createCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#1c2733' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.62, CAR.length), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.24, 0.55, CAR.length * 0.48), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = makeWheel();
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fff6c9' });
  for (const wx of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
    light.position.set(wx, 0.62, CAR.length / 2 + 0.02);
    group.add(light);
  }
  let lightBar = null;
  let sirenLight = null;
  if (kind === 'police') {
    lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: '#dddddd' }));
    lightBar.position.set(0, 1.45, -0.2);
    group.add(lightBar);
    sirenLight = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.1, 0.42),
      new THREE.MeshBasicMaterial({ color: '#ff2e2e' }),
    );
    sirenLight.position.set(0, 1.56, -0.2);
    group.add(sirenLight);
    // White doors on a dark body: the classic patrol look.
    const door = new THREE.Mesh(new THREE.BoxGeometry(CAR.width + 0.04, 0.5, 1.7), new THREE.MeshLambertMaterial({ color: '#e8e8e8' }));
    door.position.set(0, 0.6, 0.1);
    group.add(door);
  }
  return { group, wheels, lightBar, sirenLight };
}

let nextCarId = 1;

/** A car in the world: physics state plus its mesh. */
export function createCar(x, z, yaw, color, kind) {
  const mesh = createCarMesh(color, kind);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = yaw;
  return {
    id: nextCarId,
    mesh,
    x,
    z,
    yaw,
    speed: 0,
    steer: 0,
    kind,
    color,
    health: CAR.health,
    loop: null,
    loopIndex: 0,
    cruise: 10,
    sirenPhase: 0,
    stolen: false,
    driver: kind === 'traffic',
    dead: false,
    lastImpactAt: -99,
  };
}

/** Parked cars along the curbs, plus the mission getaway car. */
export function createParkedCars(random, city) {
  const cars = [];
  const spots = [];
  for (const street of CITY.streets) {
    for (const at of [-192, -64, 64, 192]) {
      spots.push({ x: at, z: street + 9.5, yaw: 0 });
      spots.push({ x: street + 9.5, z: at, yaw: Math.PI / 2 });
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const spot = spots[Math.floor(random() * spots.length)];
    const color = random() < 0.12 ? TAXI_COLOR : pick(random, CAR_COLORS);
    const car = createCar(spot.x, spot.z, spot.yaw, color, 'parked');
    cars.push(car);
  }
  return cars;
}

/** Traffic cars: each one follows a street loop at its cruise speed. */
export function createTraffic(random, city) {
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const loop = pick(random, city.loops);
    const wp = loop[Math.floor(random() * loop.length)];
    const color = random() < 0.15 ? TAXI_COLOR : pick(random, CAR_COLORS);
    const car = createCar(wp.x, wp.z, 0, color, 'traffic');
    car.loop = loop;
    car.loopIndex = Math.floor(random() * loop.length);
    car.cruise = range(random, 8, 12);
    car.speed = car.cruise;
    cars.push(car);
  }
  return cars;
}

/** One police car, spawned at a street point near the player. */
export function createPoliceCar(x, z, yaw) {
  const car = createCar(x, z, yaw, '#1c2733', 'police');
  car.cruise = 26;
  return car;
}

/** Drive a car one step: throttle -1..1, steering -1..1, with building push-out. */
export function driveCar(car, city, throttle, steerInput, dt) {
  const maxFwd = car.kind === 'police' ? 42 : CAR.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.accel * 0.7 * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxFwd, car.speed));
  const steerTarget = steerInput * CAR.steer * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.2) {
    car.yaw += (car.steer * car.speed * dt) / 2.6;
  }
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  const pushed = collideCircle(city, nx, nz, 2.2);
  if (pushed.hit) {
    // A wall hit scrubs speed and bounces the car back a little.
    if (Math.abs(car.speed) > 12) car.health -= Math.abs(car.speed) * 0.4;
    car.speed *= -0.25;
  }
  car.x = pushed.x;
  car.z = pushed.z;
  car.mesh.group.position.set(car.x, 0, car.z);
  car.mesh.group.rotation.y = car.yaw;
  for (const wheel of car.mesh.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;
  if (car.mesh.sirenLight) {
    car.sirenPhase += dt * 6;
    car.mesh.sirenLight.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2e2e : 0x2e6bff);
  }
}

/** Steer a car toward a point (x, z): returns { throttle, steer } in -1..1. */
export function steerToward(car, tx, tz, desiredSpeed) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const targetYaw = Math.atan2(dx, dz);
  let dy = targetYaw - car.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dy * 1.8));
  const throttle = car.speed < desiredSpeed ? 1 : 0.15;
  return { throttle, steer, dist };
}

/** One traffic step: follow the loop, slow down for the car ahead. */
export function stepTraffic(car, cars, city, dt) {
  if (!car.loop) return;
  const wp = car.loop[car.loopIndex];
  const ahead = steerToward(car, wp.x, wp.z, car.cruise);
  // Slow for a car stopped ahead on the same road.
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 9) {
      const facing = Math.sin(car.yaw) * dx + Math.cos(car.yaw) * dz;
      if (facing > 0 && Math.abs(dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw)) < 3) {
        if (Math.abs(other.speed) < 3) blocked = true;
      }
    }
  }
  driveCar(car, city, blocked ? -0.6 : ahead.throttle, ahead.steer, dt);
  if (ahead.dist < 6) car.loopIndex = (car.loopIndex + 1) % car.loop.length;
}

/** One police step: chase the player's position, ramming when close. */
export function stepPolice(car, px, pz, city, dt) {
  const chase = steerToward(car, px, pz, car.cruise);
  driveCar(car, city, chase.throttle, chase.steer, dt);
}
