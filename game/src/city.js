// Solmar Bay v2 — the city itself: a 10x10 grid of blocks with roads, three
// districts (downtown towers, old town, beach hotels), a park, a beach and a
// dockyard, plus palms, lamps and props. Buildings are boxes with
// canvas-painted window textures; every building also registers an AABB
// collider the player and cars resolve against.
import { WORLD, COLOURS } from './config.js';
import { range, rangeInt, pick, shuffle } from './random.js';

const THREE = window.THREE;

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rng() < 0.55 ? lit : '#20242c';
      g.fillRect(x, y, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = []; // {x, z, hx, hz}
  const buildings = [];
  const markers = {}; // named places other systems use
  const palms = [];
  const lamps = [];

  const textures = [
    windowTexture(rng, '#5b6b7d', '#ffd98a'),
    windowTexture(rng, '#7d6b5b', '#ffe9b0'),
    windowTexture(rng, '#4a5a6b', '#9fd8ff'),
    windowTexture(rng, '#6b5a6b', '#ffb0c0'),
  ];
  const mats = textures.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // Ground: one big slab, then zone overlays.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 160, WORLD.half * 2 + 160),
    new THREE.MeshLambertMaterial({ color: COLOURS.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  scene.add(ground);

  // Beach (south) and water.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 160, 90),
    new THREE.MeshLambertMaterial({ color: COLOURS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, WORLD.beachZ + 8);
  scene.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 220),
    new THREE.MeshLambertMaterial({ color: COLOURS.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WORLD.waterLevel, WORLD.beachZ + 110);
  scene.add(water);
  const waterEast = water.clone();
  waterEast.rotation.z = Math.PI / 2;
  waterEast.position.set(WORLD.dockX + 110, WORLD.waterLevel, 0);
  scene.add(waterEast);

  // Park (centre blocks).
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 92),
    new THREE.MeshLambertMaterial({ color: COLOURS.grass }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(0, 0.06, 0);
  scene.add(park);

  // Roads: dark strips along every block boundary, with centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: COLOURS.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  const pitch = WORLD.blockPitch;
  const half = WORLD.half;
  for (let i = 0; i <= WORLD.blocks; i += 1) {
    const c = -half + i * pitch - pitch / 2 + WORLD.blockSize / 2 + WORLD.roadWidth / 2;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, half * 2), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.08, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, WORLD.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.08, c);
    scene.add(h);
    // Dashes down the middle of each road.
    for (let d = -half + 12; d < half - 8; d += 16) {
      const dv = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 5), dashMat);
      dv.position.set(c, 0.1, d);
      scene.add(dv);
      const dh = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.6), dashMat);
      dh.position.set(d, 0.1, c);
      scene.add(dh);
    }
  }

  // Sidewalk frames around each block.
  const walkMat = new THREE.MeshLambertMaterial({ color: COLOURS.sidewalk });
  const blockCentres = [];
  for (let bx = 0; bx < WORLD.blocks; bx += 1) {
    for (let bz = 0; bz < WORLD.blocks; bz += 1) {
      const cx = -half + pitch / 2 + bx * pitch;
      const cz = -half + pitch / 2 + bz * pitch;
      blockCentres.push({ bx, bz, cx, cz });
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.blockSize + 4, WORLD.blockSize + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.07, cz);
      scene.add(walk);
    }
  }

  // Buildings, skipping the park blocks (bx 4-5, bz 4-5) and the cafe block.
  const parkBlocks = new Set(['4,4', '5,4', '4,5', '5,5']);
  const shuffled = shuffle(rng, blockCentres.slice());
  let placed = 0;
  for (const b of shuffled) {
    if (parkBlocks.has(`${b.bx},${b.bz}`)) continue;
    const district = b.bx <= 2 ? 'downtown' : b.bz >= 7 ? 'beach' : 'oldtown';
    const h = district === 'downtown' ? range(rng, 26, 58) : district === 'beach' ? range(rng, 12, 26) : range(rng, 8, 20);
    const w = range(rng, 16, 28);
    const d = range(rng, 16, 28);
    const mesh = new THREE.Mesh(boxGeo, mats[rangeInt(rng, 0, mats.length - 1)]);
    mesh.scale.set(w, h, d);
    mesh.position.set(b.cx + range(rng, -3, 3), h / 2, b.cz + range(rng, -3, 3));
    scene.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.8, d + 0.6);
    roof.position.set(mesh.position.x, h + 0.4, mesh.position.z);
    scene.add(roof);
    // Rooftop props on tall towers.
    if (h > 34 && rng() < 0.6) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 8), new THREE.MeshLambertMaterial({ color: 0x777777 }));
      tank.position.set(mesh.position.x + w * 0.2, h + 2, mesh.position.z - d * 0.2);
      scene.add(tank);
    }
    const col = { x: mesh.position.x, z: mesh.position.z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 };
    colliders.push(col);
    buildings.push({ ...col, h, district });
    placed += 1;
    if (placed >= 96) break;
  }

  // Named places.
  markers.cafe = { x: -138, z: 92 };
  markers.hideout = { x: 138, z: -138 };
  markers.docks = { x: 226, z: 46 };
  markers.warehouse = { x: 184, z: -92 };
  markers.beachHouse = { x: -92, z: 232 };
  markers.raceStart = { x: -138, z: -138 };
  markers.yacht = { x: 300, z: 300 };

  // Cafe: a low building with a warm awning.
  const cafe = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xb0703a }));
  cafe.scale.set(20, 7, 14);
  cafe.position.set(markers.cafe.x, 3.5, markers.cafe.z);
  scene.add(cafe);
  const awning = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd83a4a }));
  awning.scale.set(22, 0.6, 6);
  awning.position.set(markers.cafe.x, 4.6, markers.cafe.z + 8);
  scene.add(awning);
  colliders.push({ x: markers.cafe.x, z: markers.cafe.z, hx: 10.4, hz: 7.4 });

  // Warehouse at the docks side.
  const wh = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6b5a3a }));
  wh.scale.set(30, 10, 20);
  wh.position.set(markers.warehouse.x, 5, markers.warehouse.z);
  scene.add(wh);
  colliders.push({ x: markers.warehouse.x, z: markers.warehouse.z, hx: 15.4, hz: 10.4 });

  // Hideout: small house with a garage door.
  const hide = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x4a6b8a }));
  hide.scale.set(16, 6, 12);
  hide.position.set(markers.hideout.x, 3, markers.hideout.z);
  scene.add(hide);
  colliders.push({ x: markers.hideout.x, z: markers.hideout.z, hx: 8.4, hz: 6.4 });

  // Palms along the beach and park.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8a3a });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    g.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.4, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    palms.push(g);
    colliders.push({ x, z, hx: 0.6, hz: 0.6 });
  }
  for (let x = -220; x <= 220; x += 28) palm(x + range(rng, -4, 4), WORLD.beachZ - 6);
  for (let i = 0; i < 10; i += 1) palm(range(rng, -40, 40), range(rng, -40, 40));

  // Street lamps on road corners.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const lampLights = [];
  for (let i = 0; i < 24; i += 1) {
    const bx = rangeInt(rng, 0, WORLD.blocks);
    const bz = rangeInt(rng, 0, WORLD.blocks);
    const x = -half + bx * pitch - pitch / 2 + WORLD.blockSize / 2 + WORLD.roadWidth / 2 + 5;
    const z = -half + bz * pitch - pitch / 2 + WORLD.blockSize / 2 + WORLD.roadWidth / 2 + 5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), lampMat);
    pole.position.set(x, 3.25, z);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlowMat);
    bulb.position.set(x, 6.6, z);
    scene.add(bulb);
    lamps.push(bulb);
    lampLights.push({ x, z });
  }

  // Crates and benches as small props.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  for (let i = 0; i < 26; i += 1) {
    const x = range(rng, -220, 220);
    const z = range(rng, -220, 220);
    const crate = new THREE.Mesh(boxGeo, crateMat);
    const s = range(rng, 1.2, 2.2);
    crate.scale.set(s, s, s);
    crate.position.set(x, s / 2, z);
    crate.rotation.y = rng() * Math.PI;
    scene.add(crate);
    colliders.push({ x, z, hx: s / 2 + 0.2, hz: s / 2 + 0.2 });
  }

  // Docks: wooden pier jutting east into the water.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(70, 1, 14);
  pier.position.set(WORLD.dockX + 30, 1, markers.docks.z);
  scene.add(pier);
  colliders.push({ x: WORLD.dockX + 30, z: markers.docks.z, hx: 35, hz: 7 });

  return { colliders, buildings, markers, palms, lamps, lampLights, water };
}
