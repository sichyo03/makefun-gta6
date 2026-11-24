// Solmar Bay v2 — story and side work: ten missions for Mama Rosa with
// dialogue and payouts, plus taxi fares, a repeatable street race and ten
// hidden packages. Missions are data; one small state machine runs them.
import { MISSION_PAYOUTS } from './config.js';
import { range } from './random.js';

const THREE = window.THREE;

export const MISSIONS = [
  { id: 1, name: 'Meet Mama Rosa', payout: 500, intro: ['Mama Rosa: Dario! My best runner is back.', 'Mama Rosa: Come to the cafe. I have work for you.'],
    steps: [{ type: 'goto', at: 'cafe', r: 12, text: 'Go to the cafe' }, { type: 'talk', who: 'rosa', text: 'Talk to Mama Rosa' }] },
  { id: 2, name: 'Getaway Driver', payout: 800, intro: ['Mama Rosa: I need a clean car. Take one. Any one.'],
    steps: [{ type: 'steal', text: 'Steal a car — press E near one' }, { type: 'goto', at: 'hideout', r: 14, text: 'Drive to the hideout', needCar: true }] },
  { id: 3, name: 'Lose the Heat', payout: 1200, intro: ['Mama Rosa: The Bay Police are on you now.', 'Mama Rosa: Get to 3 stars, then vanish. The hideout is safe.'],
    steps: [{ type: 'heat', stars: 3, text: 'Raise your wanted level to 3 stars' }, { type: 'lose', text: 'Lose the heat — hideout or stay hidden' }] },
  { id: 4, name: 'Dock Delivery', payout: 2000, intro: ['Mama Rosa: A package for the docks. No questions, no stops.'],
    steps: [{ type: 'goto', at: 'docks', r: 10, text: 'Deliver the package to the docks' }] },
  { id: 5, name: 'Street King', payout: 2500, intro: ['Rival: You call that driving? Race me, if you dare.'],
    steps: [{ type: 'race', time: 100, text: 'Win the street race — hit every checkpoint' }] },
  { id: 6, name: 'Guardian', payout: 3000, intro: ['Mama Rosa: They are coming for me, Dario. Hold the cafe!'],
    steps: [{ type: 'defend', at: 'cafe', count: 6, text: 'Protect Mama Rosa — stop the attackers' }] },
  { id: 7, name: 'Midnight Run', payout: 3500, intro: ['Mama Rosa: Three drops. One hundred fifty seconds. Go!'],
    steps: [{ type: 'timed', time: 150, text: 'Three drops before the timer ends' }] },
  { id: 8, name: 'Escort', payout: 3000, intro: ['Mama Rosa: Drive my car to the beach house. Stay close to me.'],
    steps: [{ type: 'escort', from: 'cafe', to: 'beachHouse', text: 'Escort Rosa’s car to the beach house' }] },
  { id: 9, name: 'Takedown', payout: 4000, intro: ['Mama Rosa: The warehouse crew crossed me. End it.'],
    steps: [{ type: 'eliminate', at: 'warehouse', count: 5, text: 'Clear the warehouse crew' }] },
  { id: 10, name: 'The Big Score', payout: 10000, intro: ['Mama Rosa: The yacht. The boat. One last job, Dario — and we are rich.'],
    steps: [{ type: 'boat', at: 'yacht', r: 14, text: 'Take the boat out to the yacht' }, { type: 'lose', text: 'Lose the 4-star heat' }] },
];

const PACKAGE_SPOTS = [
  [-200, -200], [200, -200], [-200, 200], [200, 180], [0, -210],
  [-90, -40], [90, 40], [-40, 140], [140, -140], [20, 210],
];

function makeFigure(color, dress) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, dress ? 1.5 : 1.0, 0.5),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = dress ? 0.85 : 1.15;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd8a078 }),
  );
  head.position.y = dress ? 1.9 : 1.95;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.25, 0.56),
    new THREE.MeshLambertMaterial({ color: 0x888888 }),
  );
  hair.position.y = dress ? 2.2 : 2.24;
  g.add(hair);
  return g;
}

export function createMissions(world) {
  const { scene, rng } = world;
  const markers = world.city.markers;
  const state = {
    next: 0, // index of the next mission to offer
    active: null, // {def, step, runtime}
    marker: null, // {x, z} current objective marker
    objective: 'Find work — press E at the cafe to start a mission',
    dialogue: [], // queued lines {who, text}
    dialogueOpen: false,
    packages: [],
    packagesFound: 0,
    taxi: { state: 'idle', ped: null, dest: null, timer: 0 },
    race: { state: 'idle', points: [], idx: 0, timer: 0 },
    enemies: [], // armed attackers {mesh, x, z, health, radius, shootCd, speed}
    escortCar: null,
    rosa: null,
  };

  // Mama Rosa stands by the cafe.
  const rosa = makeFigure(0x7a3a8a, true);
  rosa.position.set(markers.cafe.x + 4, 0, markers.cafe.z + 10);
  scene.add(rosa);
  state.rosa = rosa;

  // Hidden packages: glowing green crates with a light beam.
  const pkgMat = new THREE.MeshLambertMaterial({ color: 0x2aff66, emissive: 0x1a8a3a });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.25 });
  for (const [x, z] of PACKAGE_SPOTS) {
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), pkgMat);
    crate.position.y = 0.6;
    g.add(crate);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 6, 1, true), beamMat);
    beam.position.y = 13;
    g.add(beam);
    g.position.set(x, 0, z);
    scene.add(g);
    state.packages.push({ mesh: g, x, z, found: false });
  }

  function setObjective(text) {
    state.objective = text;
  }

  function queueDialogue(lines) {
    for (const line of lines) state.dialogue.push(line);
    state.dialogueOpen = state.dialogue.length > 0;
  }

  function startMission(index) {
    const def = MISSIONS[index];
    state.active = { def, step: 0, runtime: {} };
    // Intro lines are "Speaker: text" — the speaker is whoever says it.
    queueDialogue(def.intro.map((t) => {
      const cut = t.indexOf(': ');
      return cut > 0 ? { who: t.slice(0, cut), text: t.slice(cut + 2) } : { who: 'Mama Rosa', text: t };
    }));
    setupStep(state.active);
    world.audio.mission();
    world.say(`Mission: ${def.name}`);
  }

  function setupStep(m) {
    const s = m.def.steps[m.step];
    const rt = m.runtime;
    rt.killed = 0;
    rt.checkpoints = [];
    rt.checkIdx = 0;
    rt.timer = 0;
    if (s.type === 'goto' || s.type === 'defend' || s.type === 'eliminate') {
      const at = markers[s.at];
      state.marker = { x: at.x, z: at.z };
    } else if (s.type === 'talk') {
      // Mama Rosa waits by the cafe, outside the building's collider.
      state.marker = { x: markers.cafe.x + 4, z: markers.cafe.z + 10 };
    } else if (s.type === 'boat') {
      state.marker = { x: markers.yacht.x, z: markers.yacht.z };
    } else if (s.type === 'race') {
      const cx = markers.raceStart.x;
      const cz = markers.raceStart.z;
      // A rectangular loop of road intersections. The east end stops at
      // x=92: the (138,-138) intersection holds the hideout house, so no
      // checkpoint can sit on it — a car cannot get within 9 of it.
      rt.checkpoints = [
        { x: cx + 230, z: cz }, { x: cx + 230, z: cz + 276 },
        { x: cx, z: cz + 276 }, { x: cx, z: cz },
      ];
      rt.checkIdx = 0;
      rt.timer = s.time;
      state.marker = rt.checkpoints[0];
    } else if (s.type === 'timed') {
      rt.checkpoints = [
        { x: -138, z: 138 }, { x: 92, z: -138 }, { x: 0, z: -184 },
      ];
      rt.checkIdx = 0;
      rt.timer = s.time;
      state.marker = rt.checkpoints[0];
    } else {
      state.marker = null;
    }
    if (s.type === 'heat') {
      world.police.heat = Math.max(world.police.heat, 0);
    }
    if (s.type === 'defend' || s.type === 'eliminate') {
      spawnEnemies(s.at, s.count, m);
    }
    if (s.type === 'escort') {
      const from = markers[s.from];
      const car = world.spawnEscortCar(from.x + 8, from.z);
      state.escortCar = car;
      state.marker = { x: car.x, z: car.z };
    }
    if (s.type === 'boat') {
      world.police.heat = 4;
      world.police.wanted = 4;
    }
    setObjective(s.text);
  }

  function spawnEnemies(at, count, m) {
    const p = markers[at];
    for (let i = 0; i < count + 2; i += 1) {
      const g = makeFigure(0x8a1a1a, false);
      const x = p.x + range(rng, -24, 24);
      const z = p.z + range(rng, -24, 24);
      g.position.set(x, 0, z);
      scene.add(g);
      state.enemies.push({ mesh: g, x, z, health: 50, radius: 1.1, kind: 'enemy', y: 1.2, shootCd: range(rng, 0.5, 1.5), speed: 5.2, mission: m });
    }
  }

  function completeStep(m) {
    m.step += 1;
    if (m.step >= m.def.steps.length) {
      completeMission(m);
    } else {
      setupStep(m);
    }
  }

  function completeMission(m) {
    world.cash += m.def.payout;
    world.audio.cash();
    world.say(`Mission complete: ${m.def.name} — $${m.def.payout}`);
    queueDialogue([{ who: 'Mama Rosa', text: `Good work, Dario. $${m.def.payout} is yours.` }]);
    state.next = Math.max(state.next, m.def.id);
    state.active = null;
    state.marker = null;
    setObjective(state.next >= MISSIONS.length ? 'All missions done — free roam Solmar Bay!' : 'Press E at the cafe for the next job');
    world.saveGame();
  }

  function failStep(m, reason) {
    world.audio.fail();
    world.say(reason);
    state.active = null;
    state.marker = null;
    clearEnemies();
    setObjective('Mission failed — press E at the cafe to try again');
  }

  function clearEnemies() {
    for (const e of state.enemies) scene.remove(e.mesh);
    state.enemies.length = 0;
  }

  function playerPos() {
    const p = world.player;
    return p.vehicle ? { x: p.vehicle.x, z: p.vehicle.z } : { x: p.x, z: p.z };
  }

  function distTo(x, z) {
    const p = playerPos();
    return Math.hypot(p.x - x, p.z - z);
  }

  function update(dt) {
    // Dialogue advance is handled by the world (E key); here just the timer.
    const m = state.active;
    if (m) {
      const s = m.def.steps[m.step];
      const rt = m.runtime;
      if (s.type === 'goto') {
        const at = markers[s.at];
        if (distTo(at.x, at.z) < s.r) {
          if (s.needCar && world.player.onFoot) {
            setObjective('You need a car for this');
          } else completeStep(m);
        }
      } else if (s.type === 'talk') {
        if (distTo(markers.cafe.x + 4, markers.cafe.z + 10) < 5 && world.consumeInteract()) {
          queueDialogue(['Mama Rosa: The city is yours, Dario. Take it.']);
          completeStep(m);
        }
      } else if (s.type === 'steal') {
        if (!world.player.onFoot) completeStep(m);
      } else if (s.type === 'heat') {
        if (world.police.wanted >= s.stars) completeStep(m);
        else setObjective(`Raise your wanted level to ${s.stars} stars (now ${world.police.wanted})`);
      } else if (s.type === 'lose') {
        if (world.police.wanted === 0) completeStep(m);
        else setObjective(`Lose the heat — ${world.police.wanted} stars left (hideout is safe)`);
      } else if (s.type === 'race' || s.type === 'timed') {
        rt.timer -= dt;
        const cp = rt.checkpoints[rt.checkIdx];
        if (cp) {
          state.marker = cp;
          if (distTo(cp.x, cp.z) < 9) {
            rt.checkIdx += 1;
            world.audio.pickup();
            if (rt.checkIdx >= rt.checkpoints.length) {
              completeStep(m);
            } else {
              setObjective(`${s.type === 'race' ? 'Race' : 'Drop'} ${rt.checkIdx + 1} of ${rt.checkpoints.length} — ${Math.ceil(rt.timer)}s left`);
            }
          }
        }
        if (rt.timer <= 0) failStep(m, s.type === 'race' ? 'Race lost — out of time' : 'Too slow — the drops expired');
      } else if (s.type === 'defend' || s.type === 'eliminate') {
        setObjective(`${s.text} (${rt.killed}/${s.count})`);
        if (rt.killed >= s.count) {
          clearEnemies();
          completeStep(m);
        }
      } else if (s.type === 'escort') {
        const car = state.escortCar;
        if (car) {
          state.marker = { x: car.x, z: car.z };
          const dest = markers[s.to];
          const dCar = Math.hypot(car.x - dest.x, car.z - dest.z);
          const dYou = distTo(car.x, car.z);
          if (dCar < 10) {
            world.removeEscortCar(car);
            state.escortCar = null;
            completeStep(m);
          } else if (dYou > 55) {
            setObjective('You lost the escort — get back to Rosa’s car!');
          } else {
            setObjective(`Escort Rosa’s car — ${Math.round(dCar)}m to the beach house`);
          }
        }
      } else if (s.type === 'boat') {
        const p = world.player;
        const inBoat = p.vehicle && p.vehicle.kind === 'boat';
        if (inBoat && distTo(markers.yacht.x, markers.yacht.z) < s.r) completeStep(m);
        else if (!inBoat) setObjective('Take the boat at the docks out to the yacht');
      }
    }

    // Enemies: chase the player and shoot.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.health <= 0) {
        scene.remove(e.mesh);
        state.enemies.splice(i, 1);
        const mm = state.active;
        if (mm && (mm.def.steps[mm.step].type === 'defend' || mm.def.steps[mm.step].type === 'eliminate')) {
          mm.runtime.killed += 1;
        }
        world.cash += 50;
        world.audio.cash();
        continue;
      }
      const p = playerPos();
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const step = Math.min(e.speed * dt, Math.max(0, dist - 10));
      e.x += (dx / dist) * step;
      e.z += (dz / dist) * step;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootCd -= dt;
      if (dist < 30 && e.shootCd <= 0) {
        e.shootCd = range(rng, 1.0, 1.8);
        world.onEnemyShot(e, dist);
      }
    }

    // Escort car drives itself toward the destination.
    if (state.escortCar) {
      const car = state.escortCar;
      const dest = markers.beachHouse;
      const dx = dest.x - car.x;
      const dz = dest.z - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dh = want - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      car.speed = Math.min(car.speed + 8 * dt, 16);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }

    // Hidden packages.
    const p = playerPos();
    for (const pkg of state.packages) {
      if (pkg.found) continue;
      if (Math.hypot(p.x - pkg.x, p.z - pkg.z) < 2.5) {
        pkg.found = true;
        scene.remove(pkg.mesh);
        state.packagesFound += 1;
        world.cash += 250;
        world.audio.pickup();
        world.say(`Hidden package ${state.packagesFound}/10 — +$250`);
        if (state.packagesFound === 10) {
          world.cash += 2500;
          world.say('All 10 packages! Bonus +$2,500');
        }
      }
    }

    // Taxi fares: a waiting ped flags the player down.
    const taxi = state.taxi;
    taxi.timer -= dt;
    if (taxi.state === 'idle' && taxi.timer <= 0) {
      taxi.timer = 20;
      const spots = [[-180, 90], [90, -180], [180, 180], [-90, -90], [40, 200]];
      const [x, z] = spots[Math.floor(rng() * spots.length)];
      const ped = makeFigure(0xd8c81a, false);
      ped.position.set(x, 0, z);
      scene.add(ped);
      taxi.ped = { mesh: ped, x, z };
      taxi.state = 'waiting';
    }
    if (taxi.state === 'waiting' && taxi.ped) {
      const d = Math.hypot(p.x - taxi.ped.x, p.z - taxi.ped.z);
      if (d < 5 && !world.player.onFoot) {
        scene.remove(taxi.ped.mesh);
        taxi.dest = { x: range(rng, -200, 200), z: range(rng, -200, 200) };
        taxi.state = 'passenger';
        world.say('Taxi fare aboard — take them to the marker');
      }
    }
    if (taxi.state === 'passenger' && taxi.dest) {
      state.taxiMarker = taxi.dest;
      if (Math.hypot(p.x - taxi.dest.x, p.z - taxi.dest.z) < 9) {
        const fare = 120 + Math.floor(rng() * 180);
        world.cash += fare;
        world.audio.cash();
        world.say(`Fare paid: +$${fare}`);
        taxi.state = 'idle';
        taxi.timer = 15;
        taxi.dest = null;
        state.taxiMarker = null;
      }
    }
  }

  return {
    state, MISSIONS, startMission, update, setObjective, queueDialogue,
    canStart() {
      return !state.active && state.next < MISSIONS.length;
    },
  };
}
