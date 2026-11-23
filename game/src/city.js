// The city of Solmar Bay: a street grid with procedural buildings, a beach to the
// south, docks to the east and a park at its heart. Everything is built from boxes
// with canvas-painted textures, so the game needs no image files. The module also
// owns collision (buildings are axis-aligned boxes) and the traffic loops.

import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

/** Make a canvas texture of a building face: windows lit and dark on a wall colour. */
function buildingTexture(random, base, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, 128, 10);
  const cellW = 128 / cols;
  const cellH = 256 / floors;
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = random() < 0.45;
      ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
      ctx.fillRect(c * cellW + cellW * 0.22, f * cellH + cellH * 0.25, cellW * 0.56, cellH * 0.5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Make a canvas texture of asphalt: a dashed centre line running along the
 *  road and pale edge lines. `across` draws it for a north-south road. */
function roadTexture(across) {
  const canvas = document.createElement('canvas');
  canvas.width = across ? 64 : 256;
  canvas.height = across ? 256 : 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d8c95a';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  if (across) {
    ctx.fillRect(4, 0, 2, 256);
    ctx.fillRect(58, 0, 2, 256);
    ctx.fillStyle = '#d8c95a';
    for (let y = 0; y < 256; y += 64) ctx.fillRect(30, y + 8, 4, 36);
  } else {
    ctx.fillRect(0, 4, 256, 2);
    ctx.fillRect(0, 58, 256, 2);
    ctx.fillStyle = '#d8c95a';
    for (let x = 0; x < 256; x += 64) ctx.fillRect(x + 8, 30, 36, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCity(random) {
  const group = new THREE.Group();
  const colliders = [];
  const buildings = [];
  const size = CITY.half * 2 + 64;
  const roadTexH = roadTexture(false);
  roadTexH.repeat.set(10, 1);
  const roadTexV = roadTexture(true);
  roadTexV.repeat.set(1, 10);
  const roadMatH = new THREE.MeshLambertMaterial({ map: roadTexH });
  const roadMatV = new THREE.MeshLambertMaterial({ map: roadTexV });

  // Ground: one big slab, sand at the south edge, grass in the park block.
  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 16);
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 64),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.1, CITY.beachZ + 32);
  group.add(beach);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 200),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, CITY.beachZ + 164);
  group.add(water);

  // Roads: dark strips along every street, with sidewalks beside them.
  const roadMat = roadMatH;
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const street of CITY.streets) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(size, CITY.streetWidth), roadMatH);
    along.rotation.x = -Math.PI / 2;
    along.position.set(0, 0.15, street);
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(CITY.streetWidth, size), roadMatV);
    across.rotation.x = -Math.PI / 2;
    across.position.set(street, 0.15, 16);
    group.add(across);
    const walkA = new THREE.Mesh(new THREE.PlaneGeometry(size, 3), walkMat);
    walkA.rotation.x = -Math.PI / 2;
    walkA.position.set(0, 0.12, street + CITY.streetWidth / 2 + 1.5);
    group.add(walkA);
    const walkB = new THREE.Mesh(new THREE.PlaneGeometry(3, size), walkMat);
    walkB.rotation.x = -Math.PI / 2;
    walkB.position.set(street + CITY.streetWidth / 2 + 1.5, 0.12, 16);
    group.add(walkB);
  }

  // Buildings: one or two per block, heights that vary, each with a lit-window face.
  const wallMats = PALETTE.building.map(
    (color) => new THREE.MeshLambertMaterial({ map: buildingTexture(random, color, 6 + Math.floor(random() * 8), 4) }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: '#4a4238' });
  const blockCenters = [];
  for (let ix = 0; ix < CITY.streets.length - 1; ix += 1) {
    for (let iz = 0; iz < CITY.streets.length - 1; iz += 1) {
      const cx = (CITY.streets[ix] + CITY.streets[ix + 1]) / 2;
      const cz = (CITY.streets[iz] + CITY.streets[iz + 1]) / 2;
      blockCenters.push({ x: cx, z: cz });
    }
  }
  // The park block (centre-north) stays open: grass, palms and a fountain.
  const park = blockCenters.find((b) => Math.abs(b.x - 0) < 1 && Math.abs(b.z + 64) < 1);
  const parkIdx = blockCenters.indexOf(park);
  if (parkIdx >= 0) blockCenters.splice(parkIdx, 1);
  const parkGround = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  parkGround.rotation.x = -Math.PI / 2;
  parkGround.position.set(0, 0.18, -64);
  group.add(parkGround);
  for (let i = 0; i < 8; i += 1) {
    const palm = makePalm(random);
    palm.position.set(range(random, -22, 22), 0, -64 + range(random, -22, 22));
    group.add(palm);
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const block of blockCenters) {
    const count = random() < 0.6 ? 2 : 1;
    for (let n = 0; n < count; n += 1) {
      const w = range(random, 16, 26);
      const d = range(random, 16, 26);
      const h = range(random, 12, 64);
      const ox = count === 1 ? 0 : (n === 0 ? -12 : 12);
      const oz = count === 1 ? 0 : (n === 0 ? -8 : 10);
      const mesh = new THREE.Mesh(boxGeo, pick(random, wallMats));
      mesh.scale.set(w, h, d);
      mesh.position.set(block.x + ox, h / 2, block.z + oz);
      group.add(mesh);
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w + 0.6, 1, d + 0.6);
      roof.position.set(block.x + ox, h + 0.5, block.z + oz);
      group.add(roof);
      colliders.push({ minX: block.x + ox - w / 2, maxX: block.x + ox + w / 2, minZ: block.z + oz - d / 2, maxZ: block.z + oz + d / 2 });
      buildings.push({ x: block.x + ox, z: block.z + oz, w, d, h });
    }
  }

  // Street lamps along the avenues, and a few palms near the beach.
  const lampMat = new THREE.MeshLambertMaterial({ color: '#22262b' });
  const lampGlow = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
  for (const street of CITY.streets) {
    for (const at of [-160, -32, 96, 224]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(at, 3, street + 8.5);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlow);
      bulb.position.set(at, 6.1, street + 8.5);
      group.add(bulb);
    }
  }
  for (let i = 0; i < 10; i += 1) {
    const palm = makePalm(random);
    palm.position.set(range(random, -260, 260), 0, CITY.beachZ + range(random, 4, 26));
    group.add(palm);
  }

  // Docks: containers stacked at the east edge, and a pier over the water.
  const containerCols = ['#b8442c', '#2c6db8', '#3f8a4a', '#c9a13a'];
  for (let i = 0; i < 9; i += 1) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(random, containerCols) }));
    const w = 12;
    const h = 2.6;
    c.scale.set(w, h, 2.6);
    c.position.set(272 + (i % 3) * 14, h / 2 + Math.floor(i / 3) * h, -160 + Math.floor(i / 3) * 0 + (i % 3) * 0 + (i % 2) * 40 - 20);
    c.position.z = -180 + (i % 3) * 44;
    group.add(c);
    colliders.push({ minX: c.position.x - w / 2, maxX: c.position.x + w / 2, minZ: c.position.z - 1.3, maxZ: c.position.z + 1.3 });
  }

  // Traffic loops: rectangles around blocks, on street centrelines.
  const loops = [
    loopRect(-224, -224, 224, 224),
    loopRect(-160, -160, 160, 160),
    loopRect(-96, -96, 96, 96),
    loopRect(-224, -32, 32, 224),
    loopRect(-32, -224, 224, 32),
  ];

  return { group, colliders, buildings, loops };
}

/** A palm: a leaning trunk and a crown of flat fronds. */
function makePalm(random) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5a38' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#3f7a3a', side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 7, 6), trunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = range(random, -0.12, 0.12);
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
    frond.position.y = 7;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.rotation.x = -0.5;
    frond.translateZ(1.6);
    palm.add(frond);
  }
  return palm;
}

/** Waypoints around a rectangle (clockwise), on the road centrelines. */
function loopRect(x0, z0, x1, z1) {
  const pts = [];
  const step = 64;
  for (let x = x0; x < x1; x += step) pts.push({ x: x + step / 2, z: z0 });
  for (let z = z0; z < z1; z += step) pts.push({ x: x1, z: z + step / 2 });
  for (let x = x1; x > x0; x -= step) pts.push({ x: x - step / 2, z: z1 });
  for (let z = z1; z > z0; z -= step) pts.push({ x: x0, z: z - step / 2 });
  return pts;
}

/**
 * Push a circle (x, z, radius) out of every building it overlaps. Returns true
 * when a push happened. Also clamps to the playable bounds.
 */
export function collideCircle(city, x, z, radius) {
  let hit = false;
  for (const c of city.colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = x - c.minX;
        const pr = c.maxX - x;
        const pt = z - c.minZ;
        const pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  const b = CITY.half;
  x = Math.max(-b, Math.min(b, x));
  z = Math.max(-b, Math.min(CITY.beachZ + 40, z));
  return { x, z, hit };
}

/** The nearest street centreline coordinate to a value (for traffic placement). */
export function nearestStreet(value) {
  let best = CITY.streets[0];
  for (const s of CITY.streets) if (Math.abs(s - value) < Math.abs(best - value)) best = s;
  return best;
}
