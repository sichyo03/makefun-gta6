// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer and HUD paint what is there. The game moves
// between four screens: title, play, paused and over (busted or wasted).
//
// ?seed=N fixes the city and the traffic. ?shot=cover|street|mission|chase
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, resetWorld, stepWorld, respawn, EVENT_BUSTED, EVENT_WASTED, EVENT_MISSION, EVENT_STORY } from './world.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { readSave, writeSave, clearSave } from './save.js';
import { startMission } from './missions.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(createRandom(seed), renderer.scene);
const hud = createHud(
  {
    cash: document.getElementById('hud-cash'),
    healthFill: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    wanted: document.getElementById('hud-wanted'),
    objective: document.getElementById('hud-objective'),
    distance: document.getElementById('hud-distance'),
    speed: document.getElementById('hud-speed'),
    minimap: document.getElementById('minimap'),
    crosshair: document.getElementById('crosshair'),
    dialogue: document.getElementById('dialogue'),
    dialogueName: document.getElementById('dialogue-name'),
    dialogueText: document.getElementById('dialogue-text'),
  },
  world.city,
);

const hudEl = document.getElementById('hud');
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const endEl = document.getElementById('end-screen');
const endTitleEl = document.getElementById('end-title');
const endTextEl = document.getElementById('end-text');
const toastEl = document.getElementById('toast');
const damageEl = document.getElementById('damage');
const continueBtn = document.getElementById('btn-continue');
const newBtn = document.getElementById('btn-new');

const dummyInput = {
  move() {
    return { fwd: 0, strafe: 0, run: false };
  },
  takeDrag() {
    return { x: 0, y: 0 };
  },
  takeActions() {
    return 0;
  },
};

function announce(message) {
  status.textContent = message;
}

function saveGame() {
  writeSave({
    missionIndex: world.missions.index,
    cash: world.cash,
    x: world.player.x,
    z: world.player.z,
    health: Math.round(world.player.health),
    storyDone: world.missions.done,
  });
}

let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
  }, 2600);
}

function showOnly(el) {
  for (const overlay of [titleEl, pauseEl, endEl]) overlay.style.display = 'none';
  if (el) el.style.display = 'flex';
  hudEl.style.display = el === null ? 'block' : 'none';
}

function runShot(name) {
  showOnly(null);
  const staged = stageShot(name, world, renderer);
  hud.update(world, staged.screen);
  renderer.draw(world, world.time);
  renderer.draw(world, world.time);
  window.__shotReady = true;
}

function runGame() {
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  const save = readSave();
  if (save) {
    continueBtn.style.display = 'inline-block';
  }

  // The title screen shows the living city behind it; no dialogue yet.
  world.missions.dialogue = null;
  world.player.camDist = 34;
  world.player.camPitch = 0.62;
  showOnly(titleEl);
  announce('Solmar Bay. Press Space or click to start.');

  function startGame(fromSave) {
    audio.unlock();
    resetWorld(world, seed);
    if (fromSave && save) {
      world.cash = save.cash || 0;
      world.player.x = save.x ?? -32;
      world.player.z = save.z ?? -64;
      world.player.health = save.health || 100;
      startMission(world.missions, Math.min(save.missionIndex || 0, 3));
      if (save.storyDone) {
        startMission(world.missions, 4);
      }
    } else {
      clearSave();
      startMission(world.missions, 0);
    }
    world.player.camDist = 9;
    world.player.camPitch = 0.32;
    world.player.camYaw = Math.PI;
    screen = 'play';
    showOnly(null);
    announce('Playing. Follow the yellow marker.');
  }

  function endGame(kind) {
    screen = 'over';
    audio.setEngine(0);
    audio.setSiren(false);
    if (kind === 'busted') {
      endTitleEl.textContent = 'BUSTED';
      endTextEl.textContent = 'The Bay Police took you in. You lose $500 and walk out at Solmar General.';
    } else {
      endTitleEl.textContent = 'WASTED';
      endTextEl.textContent = 'Dario went down. You lose $500 and wake up at Solmar General.';
    }
    saveGame();
    showOnly(endEl);
    announce(`${endTitleEl.textContent}. Press Space to continue.`);
  }

  newBtn.addEventListener('click', () => startGame(false));
  continueBtn.addEventListener('click', () => startGame(true));

  function handleEvents(events) {
    if (events & EVENT_BUSTED) {
      respawn(world);
      endGame('busted');
    } else if (events & EVENT_WASTED) {
      respawn(world);
      endGame('wasted');
    } else {
      if (events & EVENT_MISSION) {
        showToast(`Mission complete — +$${world.missions.cash}`);
        saveGame();
      }
      if (events & EVENT_STORY) {
        showToast('Story complete — Solmar Bay is yours. +$2,000');
        saveGame();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) {
        startGame(Boolean(save));
      } else {
        world.player.camYaw += 0.0006;
        while (accumulator >= STEP) {
          stepWorld(world, dummyInput, renderer.camera, audio, STEP);
          accumulator -= STEP;
        }
        hud.update(world, 'title');
        renderer.draw(world, world.time);
      }
      return;
    }
    if (screen === 'over') {
      if (actions & ACTION_CONFIRM) {
        screen = 'play';
        showOnly(null);
        announce('Playing.');
      }
      renderer.draw(world, world.time);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        showOnly(pauseEl);
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        showOnly(null);
        announce('Playing.');
      }
    }
    if (screen === 'paused') {
      renderer.draw(world, world.time);
      return;
    }
    // Play: feed the actions to the first step only, so a press is never
    // counted twice when one frame runs several fixed steps.
    let pendingActions = actions;
    const liveInput = {
      move: () => input.move(),
      takeDrag: () => input.takeDrag(),
      takeActions: () => {
        const taken = pendingActions;
        pendingActions = 0;
        return taken;
      },
    };
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      const events = stepWorld(world, liveInput, renderer.camera, audio, STEP);
      accumulator -= STEP;
      guard += 1;
      if (events) handleEvents(events);
      if (screen !== 'play') break;
    }
    if (screen !== 'play') return;
    hud.update(world, 'play');
    // A red flash right after taking damage, and a pulse at low health.
    const sinceHit = world.time - world.player.lastDamageAt;
    const lowHealth = world.player.health < 25 ? 0.25 + 0.1 * Math.sin(world.time * 6) : 0;
    damageEl.style.opacity = sinceHit < 0.35 ? '0.5' : String(Math.max(0, lowHealth));
    renderer.draw(world, world.time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      showOnly(pauseEl);
      announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
