// Dario Venn on foot: a low-poly figure of boxes, WASD movement relative to the
// camera, a walk-cycle swing on the legs and arms, and a simple pistol pose when
// the weapon is out. The module owns the figure's mesh and its step.

import { PLAYER } from './config.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

export function createPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: '#c98d64' });
  const shirt = new THREE.MeshLambertMaterial({ color: PLAYER_SHIRT });
  const pants = new THREE.MeshLambertMaterial({ color: '#2c3242' });
  const hair = new THREE.MeshLambertMaterial({ color: '#1e150c' });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.78;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), hair);
  hairTop.position.y = 2.0;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.28), pants);
  legL.position.set(-0.17, 0.4, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.28), pants);
  legR.position.set(0.17, 0.4, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), shirt);
  armL.position.set(-0.44, 1.18, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), shirt);
  armR.position.set(0.44, 1.18, 0);
  group.add(armR);
  // The pistol: a small dark box in the right hand, shown only when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.42), new THREE.MeshLambertMaterial({ color: '#14161a' }));
  gun.position.set(0.44, 0.86, 0.22);
  gun.visible = false;
  group.add(gun);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR, armL, armR, gun };
}

const PLAYER_SHIRT = '#2f7fd0';

/** The player on foot: position, facing, camera yaw and walk phase. */
export function createPlayer(x, z) {
  const mesh = createPlayerMesh();
  mesh.group.position.set(x, 0, z);
  return {
    mesh,
    x,
    z,
    yaw: 0,
    camYaw: 0,
    camPitch: 0.32,
    camDist: 9,
    health: PLAYER.health,
    walkPhase: 0,
    moving: false,
    armed: false,
    speed: 0,
  };
}

/**
 * One step on foot. `move` is { fwd, strafe, run } in camera space; the player
 * turns toward the direction of travel and walks there, pushed out of buildings.
 */
export function stepPlayer(player, city, move, dt) {
  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mag = Math.hypot(move.fwd, move.strafe);
  player.moving = mag > 0.1;
  if (player.moving) {
    const fwdX = -Math.sin(player.camYaw);
    const fwdZ = -Math.cos(player.camYaw);
    const rightX = Math.cos(player.camYaw);
    const rightZ = -Math.sin(player.camYaw);
    let dx = fwdX * move.fwd + rightX * move.strafe;
    let dz = fwdZ * move.fwd + rightZ * move.strafe;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.yaw += Math.max(-PLAYER.turnSpeed * dt, Math.min(PLAYER.turnSpeed * dt, dy));
    player.x += dx * speed * dt;
    player.z += dz * speed * dt;
    player.speed = speed;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.speed = 0;
  }
  const pushed = collideCircle(city, player.x, player.z, PLAYER.radius);
  player.x = pushed.x;
  player.z = pushed.z;
  // Pose the figure: legs and arms swing with the walk, the gun shows when armed.
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.mesh.legL.rotation.x = swing;
  player.mesh.legR.rotation.x = -swing;
  player.mesh.armL.rotation.x = -swing * 0.8;
  player.mesh.armR.rotation.x = player.armed ? -1.2 : swing * 0.8;
  player.mesh.gun.visible = player.armed;
  player.mesh.group.position.set(player.x, 0, player.z);
  player.mesh.group.rotation.y = player.yaw;
}
