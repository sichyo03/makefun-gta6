// Solmar Bay v2 — boot and the one loop. The game runs in fixed 1/60 s
// steps; screens are title, play, paused and game over. With
// ?shot=cover|street|mission|pursuit&seed=N the game stages that scene
// with a scripted driver instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHUD } from './hud.js';
import { createWorld } from './world.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const audio = createAudio();
const renderer = createRenderer(canvas);
const hud = createHUD();
const input = createInput(canvas);

// Scripted driver for ?shot= mode: mimics the input the world reads.
const script = { ax: { x: 0, y: 0 }, fire: false, actions: 0 };
const shotInput = {
  axes: () => ({ ...script.ax }),
  look: () => 0,
  takeActions: () => 0,
  takeDigit: () => 0,
  sprinting: () => false,
  firing: () => script.fire,
  held: () => false,
  mouse: { down: false, dx: 0, dy: 0 },
};

const { world, update } = createWorld(renderer, shot ? shotInput : input, hud, audio, rng);
window.__game = { world, renderer, hud, audio };

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, world, script);
  for (let i = 0; i < scene.steps; i += 1) {
    update(STEP);
  }
  renderer.render();
  let painted = 0;
  function paint() {
    renderer.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  const save = world.loadSave();
  hud.setScreen('title', { hasSave: !!save });
  announce('Solmar Bay. Press Enter or click New Game to start.');

  function startGame(fresh) {
    audio.ensure();
    if (fresh) {
      try { window.localStorage.removeItem('solmar-bay-v2-save'); } catch { /* ignore */ }
      world.cash = 200;
    } else if (save) {
      world.applySave(save);
    }
    screen = 'play';
    hud.setScreen(null);
    announce('Playing. Drive with WASD, E to enter a car, F to shoot.');
  }

  hud.onNew(() => startGame(true));
  hud.onContinue(() => startGame(false));
  hud.onResume(() => {
    screen = 'play';
    hud.setScreen(null);
  });
  hud.onRestart(() => window.location.reload());
  canvas.addEventListener('mousedown', () => audio.ensure());

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && screen === 'title') {
      startGame(false);
    } else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'pause';
      hud.setScreen('pause');
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'pause') {
      screen = 'play';
      hud.setScreen(null);
      announce('Playing.');
    }
    if (screen === 'play' || screen === 'title') {
      let firstStep = true;
      while (accumulator >= STEP && (screen === 'play' || screen === 'title')) {
        update(STEP, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (world.over) {
          screen = 'over';
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    if (screen !== 'over') renderer.render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      hud.setScreen('pause');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
