// The HUD: DOM panels for cash, health, wanted stars, objective and dialogue,
// plus a live minimap drawn on a small canvas — roads, buildings, the player,
// traffic, police and the mission marker, north-up. The module only reads the
// world state and paints; it owns no game rules.

import { CITY, PALETTE } from './config.js';
import { currentDialogue } from './missions.js';

const MAP_SIZE = 190;
const WORLD_SPAN = CITY.half * 2 + 80;

function worldToMap(x, z) {
  const s = MAP_SIZE / WORLD_SPAN;
  return { x: (x + WORLD_SPAN / 2) * s, y: (z + WORLD_SPAN / 2) * s };
}

export function createHud(elements, city) {
  const ctx = elements.minimap.getContext('2d');
  let lastObjective = '';
  let lastCash = -1;
  let lastHealth = -1;
  let lastWanted = -1;
  let lastSpeed = -1;
  let lastDialogue = '';

  function drawMinimap(state) {
    const s = MAP_SIZE / WORLD_SPAN;
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Beach and water along the south edge.
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(0, worldToMap(0, CITY.beachZ).y, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, worldToMap(0, CITY.beachZ + 64).y, MAP_SIZE, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#555049';
    ctx.lineWidth = Math.max(2, CITY.streetWidth * s);
    for (const street of CITY.streets) {
      const a = worldToMap(-WORLD_SPAN / 2, street);
      const b = worldToMap(WORLD_SPAN / 2, street);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = worldToMap(street, -WORLD_SPAN / 2);
      const d = worldToMap(street, WORLD_SPAN / 2);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#3a3f4a';
    for (const b of city.buildings) {
      const p = worldToMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(p.x, p.y, Math.max(2, b.w * s), Math.max(2, b.d * s));
    }
    // Mission marker.
    if (state.missions.marker) {
      const m = worldToMap(state.missions.marker.x, state.missions.marker.z);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic (white), police (blue), player (arrow).
    for (const car of state.cars) {
      if (car.dead) continue;
      const p = worldToMap(car.x, car.z);
      ctx.fillStyle = car.kind === 'police' ? '#4aa3ff' : car === state.player.car ? '#37d67a' : '#dddddd';
      ctx.beginPath();
      ctx.arc(p.x, p.y, car.kind === 'police' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      const p = worldToMap(ped.x, ped.z);
      ctx.fillStyle = '#8b93a3';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    const pp = worldToMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(state.player.onFoot ? state.player.yaw : state.player.car ? state.player.car.yaw : 0);
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function setText(el, value, last) {
    if (value !== last) el.textContent = value;
    return value;
  }

  return {
    /** Paint one frame of HUD from the world state. Cheap: text only on change. */
    update(state, screen) {
      const p = state.player;
      lastCash = setText(elements.cash, `$${state.cash.toLocaleString('en-US')}`, lastCash);
      const health = Math.max(0, Math.round(p.health));
      if (health !== lastHealth) {
        lastHealth = health;
        elements.healthFill.style.width = `${health}%`;
        elements.healthFill.style.background = health > 50 ? '#37d67a' : health > 25 ? '#f2c230' : '#e5534b';
        elements.healthText.textContent = `${health}`;
      }
      if (state.wanted !== lastWanted) {
        lastWanted = state.wanted;
        let stars = '';
        for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
        elements.wanted.textContent = stars;
        elements.wanted.style.opacity = state.wanted > 0 ? '1' : '0.35';
      }
      const objective = state.missions.objective;
      if (objective !== lastObjective) {
        lastObjective = objective;
        elements.objective.textContent = objective;
      }
      if (state.missions.marker) {
        const d = Math.hypot(p.x - state.missions.marker.x, p.z - state.missions.marker.z);
        const dist = `${Math.round(d)}m`;
        if (dist !== elements.distance.textContent) elements.distance.textContent = dist;
      } else {
        elements.distance.textContent = '';
      }
      const speed = p.car ? Math.round(Math.abs(p.car.speed) * 3.6) : 0;
      if (speed !== lastSpeed) {
        lastSpeed = speed;
        elements.speed.textContent = p.car ? `${speed} km/h` : '';
      }
      elements.crosshair.style.display = p.onFoot && p.armed && screen === 'play' ? 'block' : 'none';
      const line = currentDialogue(state.missions);
      const dialogue = line ? `${line[0]}: ${line[1]}` : '';
      if (dialogue !== lastDialogue) {
        lastDialogue = dialogue;
        if (line) {
          elements.dialogue.style.display = 'block';
          elements.dialogueName.textContent = line[0];
          elements.dialogueText.textContent = line[1];
        } else {
          elements.dialogue.style.display = 'none';
        }
      }
      drawMinimap(state);
    },
  };
}
