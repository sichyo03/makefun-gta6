// Solmar Bay v2 — renderer: the three.js renderer, chase camera and the
// day/night sky. Owns the camera rig; the world owns the gameplay.
import { COLOURS } from './config.js';

const THREE = window.THREE;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOURS.skyDay);
  scene.fog = new THREE.Fog(COLOURS.skyDay, 120, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 12, -18);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f22, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLOURS.sunDay, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  const nightLamp = new THREE.PointLight(0xffe9a0, 0, 60);
  scene.add(nightLamp);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Camera state: yaw/pitch around the target, smoothed.
  const cam = { yaw: 0, pitch: 0.32, dist: 13, height: 4.2, target: new THREE.Vector3() };
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  function updateCamera(dt, target, heading, mode) {
    // mode: 'foot' | 'car' | 'boat' — car pulls the camera back and lower.
    const dist = mode === 'car' ? 15 : mode === 'boat' ? 18 : 11;
    const height = mode === 'car' ? 5.2 : mode === 'boat' ? 7 : 3.6;
    cam.dist += (dist - cam.dist) * Math.min(1, dt * 3);
    cam.height += (height - cam.height) * Math.min(1, dt * 3);
    cam.target.lerp(target, Math.min(1, dt * 10));
    // Camera yaw eases toward behind the heading when driving.
    let dy = heading - cam.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    cam.yaw += dy * Math.min(1, dt * (mode === 'foot' ? 1.2 : 2.2));
    desired.set(
      cam.target.x - Math.sin(cam.yaw) * cam.dist,
      cam.target.y + cam.height + Math.sin(cam.pitch) * cam.dist * 0.4,
      cam.target.z - Math.cos(cam.yaw) * cam.dist,
    );
    camera.position.lerp(desired, Math.min(1, dt * 8));
    lookAt.copy(cam.target);
    lookAt.y += 1.6;
    camera.lookAt(lookAt);
  }

  function addYaw(delta) {
    cam.yaw += delta;
  }

  function setYaw(yaw) {
    cam.yaw = yaw;
  }

  /** t in [0,1): 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight. */
  function setDayNight(t) {
    const day = Math.max(0, Math.sin(t * Math.PI * 2)); // 1 at noon, 0 at night
    const dusk = Math.max(0, 1 - Math.abs(t - 0.5) * 4); // peaks at dusk
    const sky = new THREE.Color(COLOURS.skyDay).lerp(new THREE.Color(COLOURS.skyNight), 1 - day);
    sky.lerp(new THREE.Color(COLOURS.skyDusk), dusk * 0.55);
    scene.background = sky;
    scene.fog.color.copy(sky);
    hemi.intensity = 0.25 + day * 0.65;
    sun.intensity = 0.15 + day * 1.45;
    const a = t * Math.PI * 2;
    sun.position.set(Math.cos(a) * 160, Math.max(20, Math.sin(a) * 180 + 40), Math.sin(a) * 120 + 40);
    nightLamp.intensity = day < 0.35 ? 1.6 : 0;
    return day;
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, cam, updateCamera, addYaw, setYaw, setDayNight, render, nightLamp };
}
