// Solmar Bay v2 — Dario Venn on foot: third-person movement, sprint, and
// getting in and out of cars, bikes and boats. The camera yaw is the
// player's facing when on foot.
import { PLAYER } from './config.js';

const THREE = window.THREE;

export function createPlayer(scene) {
  const group = new THREE.Group();
  // Body: jacket, head, legs — a simple readable figure.
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.0, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x2a6b3a }),
  );
  jacket.position.y = 1.15;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd8a078 }),
  );
  head.position.y = 1.95;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
  for (const sx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), legMat);
    leg.position.set(sx, 0.45, 0);
    leg.name = sx < 0 ? 'legL' : 'legR';
    group.add(leg);
  }
  const armMat = new THREE.MeshLambertMaterial({ color: 0x2a6b3a });
  for (const sx of [-0.55, 0.55]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), armMat);
    arm.position.set(sx, 1.2, 0);
    arm.name = sx < 0 ? 'armL' : 'armR';
    group.add(arm);
  }
  scene.add(group);
  return {
    mesh: group,
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    health: PLAYER.maxHealth,
    onFoot: true,
    vehicle: null,
    walkPhase: 0,
    visible: true,
  };
}

/** Resolve a circle (x, z, r) against building AABBs; returns corrected x/z. */
export function collideCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
    const cz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 0.0001) {
        x = c.x + c.hx + r;
      } else {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      }
    }
  }
  return { x, z };
}

export function updatePlayerOnFoot(player, dt, input, camYaw, colliders, world) {
  const ax = input.axes();
  const sprint = input.sprinting();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Movement is relative to the camera yaw.
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  const mx = -ax.x * cos + ax.y * sin;
  const mz = ax.x * sin + ax.y * cos;
  const moving = ax.x !== 0 || ax.y !== 0;
  const targetSpeed = moving ? speed : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
  if (moving) {
    const len = Math.hypot(mx, mz) || 1;
    player.x += (mx / len) * player.speed * dt;
    player.z += (mz / len) * player.speed * dt;
    player.heading = Math.atan2(mx / len, mz / len);
    player.walkPhase += dt * player.speed * 1.6;
  }
  // Keep inside the playable area (city + beach + docks).
  player.x = Math.max(-245, Math.min(245, player.x));
  player.z = Math.max(-245, Math.min(295, player.z));
  const solved = collideCircle(player.x, player.z, PLAYER.radius, colliders);
  player.x = solved.x;
  player.z = solved.z;
  // Pose: face the heading, swing the legs while walking.
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const swing = moving ? Math.sin(player.walkPhase) * 0.5 : 0;
  const legL = player.mesh.getObjectByName('legL');
  const legR = player.mesh.getObjectByName('legR');
  const armL = player.mesh.getObjectByName('armL');
  const armR = player.mesh.getObjectByName('armR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  if (armL) armL.rotation.x = -swing * 0.7;
  if (armR) armR.rotation.x = swing * 0.7;
  // Aim: when firing, face the camera direction.
  if (input.firing() && world) {
    player.heading = camYaw;
    player.mesh.rotation.y = player.heading;
  }
}
