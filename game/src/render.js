// Drawing only: the three.js scene, the golden-hour light, the third-person
// camera rig and the mission beacon. The simulation lives in world.js; this
// module only turns the world's state into pixels.

import { CITY, PALETTE } from './config.js';

const THREE = window.THREE;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 700);

  // Golden-hour sun: warm, low, long shadows. A soft hemisphere fill keeps
  // the shaded sides readable.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-180, 140, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9fc8e8, 0x8a6a4a, 0.9);
  scene.add(hemi);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  camera.position.set(0, 10, 20);

  // The mission beacon: a glowing column and a floating diamond over the marker.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: PALETTE.marker,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker }),
  );
  diamond.visible = false;
  scene.add(diamond);

  const view = { camPos: new THREE.Vector3(0, 10, 20), lookAt: new THREE.Vector3() };

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /** Where the camera should sit for the current player state. */
  function cameraTarget(player) {
    const onFoot = player.onFoot;
    const dist = onFoot ? player.camDist : player.camDist + 4;
    const height = onFoot ? 3.2 : 4.4;
    const yaw = player.camYaw;
    const pitch = player.camPitch;
    // Camera forward is (-sin yaw, -cos yaw); the camera sits behind it.
    const cx = player.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = player.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = height + Math.sin(pitch) * dist;
    const lx = player.x;
    const lz = player.z;
    const ly = onFoot ? 1.6 : 1.4;
    return { cx, cy, cz, lx, ly, lz };
  }

  return {
    scene,
    camera,
    renderer,
    /** Paint one frame: ease the camera to its target, move the beacon, render. */
    draw(state, time) {
      const player = state.player;
      // The figure only shows on foot: in a car, the driver sits inside it.
      player.mesh.group.visible = player.onFoot;
      const target = cameraTarget(player);
      const k = 1 - Math.pow(0.0001, 1 / 60);
      view.camPos.x += (target.cx - view.camPos.x) * k;
      view.camPos.y += (target.cy - view.camPos.y) * k;
      view.camPos.z += (target.cz - view.camPos.z) * k;
      view.lookAt.set(target.lx, target.ly, target.lz);
      camera.position.copy(view.camPos);
      camera.lookAt(view.lookAt);
      if (state.missions.marker) {
        beacon.visible = true;
        diamond.visible = true;
        beacon.position.set(state.missions.marker.x, 30, state.missions.marker.z);
        diamond.position.set(state.missions.marker.x, 9 + Math.sin(time * 2) * 0.6, state.missions.marker.z);
        diamond.rotation.y = time * 1.5;
      } else {
        beacon.visible = false;
        diamond.visible = false;
      }
      renderer.render(scene, camera);
    },
    /** Snap the camera to its target at once (for staged screenshots). */
    snapCamera(state) {
      const target = cameraTarget(state.player);
      view.camPos.set(target.cx, target.cy, target.cz);
      camera.position.copy(view.camPos);
      camera.lookAt(target.lx, target.ly, target.lz);
    },
  };
}
