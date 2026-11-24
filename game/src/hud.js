// Solmar Bay v2 — the HUD: cash, health, wanted stars, weapon and ammo,
// objective, radio, speed, a live minimap, dialogue, toasts, damage flash,
// and the title / pause / game-over screens. All DOM, crisp at any size.
import { WORLD } from './config.js';

function el(tag, id, parent, text) {
  // Literal tag names only: every createElement call names its tag in the
  // source, so a static checker can resolve each element without guessing.
  const e = tag === 'canvas' ? document.createElement('canvas')
    : tag === 'h1' ? document.createElement('h1')
    : tag === 'p' ? document.createElement('p')
    : tag === 'button' ? document.createElement('button')
    : document.createElement('div');
  if (id) e.id = id;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHUD() {
  const root = document.getElementById('hud');
  const topLeft = el('div', 'hud-topleft', root);
  const cash = el('div', 'hud-cash', topLeft, '$0');
  const objective = el('div', 'hud-objective', topLeft, '');
  const clock = el('div', 'hud-clock', topLeft, '');
  const topRight = el('div', 'hud-topright', root);
  const stars = el('div', 'hud-stars', topRight, '');
  const healthWrap = el('div', 'hud-health', topRight);
  const healthBar = el('div', 'hud-healthbar', healthWrap);
  const weapon = el('div', 'hud-weapon', topRight, '');
  const bottomLeft = el('div', 'hud-bottomleft', root);
  const speed = el('div', 'hud-speed', bottomLeft, '');
  const radio = el('div', 'hud-radio', bottomLeft, '');
  const minimap = el('canvas', 'hud-minimap', root);
  minimap.width = 176;
  minimap.height = 176;
  const crosshair = el('div', 'hud-crosshair', root, '+');
  const toast = el('div', 'hud-toast', root, '');
  const dialogue = el('div', 'hud-dialogue', root);
  const dlgWho = el('div', 'hud-dlgwho', dialogue, '');
  const dlgText = el('div', 'hud-dlgtext', dialogue, '');
  el('div', 'hud-dlghint', dialogue, 'E ▸ lanjut');
  const vignette = el('div', 'hud-vignette', root);
  dialogue.style.display = 'none';

  // Screens.
  const title = el('div', 'screen-title', root);
  el('h1', null, title, 'SOLMAR BAY');
  el('p', 'screen-sub', title, 'An original open-world crime game — drive, steal, outrun the Bay Police, run jobs for Mama Rosa.');
  const btnNew = el('button', 'btn-new', title, 'New Game');
  const btnContinue = el('button', 'btn-continue', title, 'Continue');
  el('p', 'screen-controls', title, 'WASD move/drive · Mouse drag camera · E enter car / talk · F or click shoot · 1/2/3 weapons · R reload · C radio · Shift sprint · P pause');
  const pause = el('div', 'screen-pause', root);
  el('h1', null, pause, 'PAUSED');
  const btnResume = el('button', 'btn-resume', pause, 'Resume');
  const over = el('div', 'screen-over', root);
  const overTitle = el('h1', null, over, 'WASTED');
  const overText = el('p', null, over, '');
  const btnRestart = el('button', 'btn-restart', over, 'Try Again');

  let toastTimer = 0;
  let flashTimer = 0;

  function showToast(text) {
    toast.textContent = text;
    toast.style.opacity = '1';
    toastTimer = 2.6;
  }

  function flash() {
    vignette.style.opacity = '0.55';
    flashTimer = 0.35;
  }

  function drawMinimap(world) {
    const g = minimap.getContext('2d');
    const S = 176;
    const scale = S / 560;
    const ox = S / 2;
    const oz = S / 2 + 8;
    const px = (x) => ox + x * scale;
    const pz = (z) => oz + z * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#10141a';
    g.fillRect(0, 0, S, S);
    // Water and sand.
    g.fillStyle = '#1d6f8f';
    g.fillRect(0, pz(232), S, S - pz(232));
    g.fillRect(px(232), 0, S - px(232), S);
    g.fillStyle = '#e8d29a';
    g.fillRect(0, pz(232), S, 6);
    // Park.
    g.fillStyle = '#2f6b2f';
    g.fillRect(px(-46), pz(-46), 92 * scale, 92 * scale);
    // Roads.
    g.strokeStyle = '#4a4f57';
    g.lineWidth = 4;
    const pitch = WORLD.blockPitch;
    for (let i = 0; i <= WORLD.blocks; i += 1) {
      const c = -WORLD.half + i * pitch - pitch / 2 + WORLD.blockSize / 2 + WORLD.roadWidth / 2;
      g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(c)); g.lineTo(S, pz(c)); g.stroke();
    }
    // Buildings.
    g.fillStyle = '#7a7f87';
    for (const b of world.city.buildings) {
      g.fillRect(px(b.x - b.hx), pz(b.z - b.hz), b.hx * 2 * scale, b.hz * 2 * scale);
    }
    // Packages.
    g.fillStyle = '#2aff66';
    for (const pkg of world.missions.state.packages) {
      if (!pkg.found) g.fillRect(px(pkg.x) - 2, pz(pkg.z) - 2, 4, 4);
    }
    // Police.
    g.fillStyle = '#3a6bff';
    for (const c of world.police.cars) g.fillRect(px(c.x) - 2, pz(c.z) - 2, 4, 4);
    for (const c of world.police.cops) g.fillRect(px(c.x) - 2, pz(c.z) - 2, 4, 4);
    if (world.police.heli) {
      g.fillStyle = '#ff5a5a';
      g.fillRect(px(world.police.heli.mesh.position.x) - 3, pz(world.police.heli.mesh.position.z) - 3, 6, 6);
    }
    // Mission marker (pulsing diamond).
    const mk = world.missions.state.marker || world.missions.state.taxiMarker;
    if (mk) {
      const t = performance.now() / 300;
      g.fillStyle = Math.sin(t) > 0 ? '#ffd81a' : '#ff9a1a';
      g.beginPath();
      g.moveTo(px(mk.x), pz(mk.z) - 6);
      g.lineTo(px(mk.x) + 5, pz(mk.z));
      g.lineTo(px(mk.x), pz(mk.z) + 6);
      g.lineTo(px(mk.x) - 5, pz(mk.z));
      g.closePath();
      g.fill();
    }
    // Player arrow.
    const p = world.player;
    const pxx = p.vehicle ? p.vehicle.x : p.x;
    const pzz = p.vehicle ? p.vehicle.z : p.z;
    const heading = p.vehicle ? p.vehicle.heading : p.heading;
    g.fillStyle = '#2aff66';
    g.beginPath();
    g.moveTo(px(pxx) + Math.sin(heading) * 7, pz(pzz) + Math.cos(heading) * 7);
    g.lineTo(px(pxx) + Math.sin(heading + 2.6) * 5, pz(pzz) + Math.cos(heading + 2.6) * 5);
    g.lineTo(px(pxx) + Math.sin(heading - 2.6) * 5, pz(pzz) + Math.cos(heading - 2.6) * 5);
    g.closePath();
    g.fill();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.fillText('N', 4, 12);
  }

  function update(world, dt) {
    cash.textContent = `$${world.cash.toLocaleString('en-US')}`;
    objective.textContent = world.missions.state.objective;
    const day = world.dayTime;
    const hh = Math.floor(((day * 24 + 6) % 24));
    const mm = Math.floor((((day * 24 + 6) % 1) * 60));
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${world.missions.state.next}/${world.missions.MISSIONS.length} jobs`;
    const w = world.police.wanted;
    stars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    stars.style.color = w >= 4 ? '#ff3a3a' : w >= 2 ? '#ffb13a' : '#ffd81a';
    healthBar.style.width = `${Math.max(0, world.player.health)}%`;
    healthBar.style.background = world.player.health > 50 ? '#2aff66' : world.player.health > 25 ? '#ffb13a' : '#ff3a3a';
    const ld = world.loadout;
    const wdef = world.weapons[ld.current];
    const reloading = ld.reloading > 0 ? ' — reloading…' : '';
    weapon.textContent = `${wdef.name}  ${ld.inMag[ld.current]} / ${ld.ammo[ld.current]}${reloading}`;
    const p = world.player;
    if (p.vehicle) {
      const kmh = Math.round(Math.abs(p.vehicle.speed) * 3.2);
      speed.textContent = `${kmh} km/h · ${p.vehicle.def.name}`;
    } else {
      speed.textContent = 'On foot';
    }
    radio.textContent = `♪ ${world.audio.stationName()}`;
    crosshair.style.opacity = world.player.onFoot ? '1' : '0';
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.style.opacity = '0';
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      vignette.style.opacity = String(Math.max(0, flashTimer / 0.35) * 0.55);
    }
    drawMinimap(world);
  }

  function setDialogue(line) {
    if (!line) {
      dialogue.style.display = 'none';
      return;
    }
    dialogue.style.display = 'block';
    dlgWho.textContent = line.who;
    dlgText.textContent = line.text;
  }

  function setScreen(name, data) {
    title.style.display = name === 'title' ? 'flex' : 'none';
    pause.style.display = name === 'pause' ? 'flex' : 'none';
    over.style.display = name === 'over' ? 'flex' : 'none';
    if (name === 'title') {
      btnContinue.style.display = data && data.hasSave ? 'block' : 'none';
    }
    if (name === 'over' && data) {
      overTitle.textContent = data.title;
      overText.textContent = data.text;
    }
  }

  return {
    update, showToast, flash, setDialogue, setScreen,
    onNew: (fn) => btnNew.addEventListener('click', fn),
    onContinue: (fn) => btnContinue.addEventListener('click', fn),
    onResume: (fn) => btnResume.addEventListener('click', fn),
    onRestart: (fn) => btnRestart.addEventListener('click', fn),
  };
}
