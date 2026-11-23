// The story: four missions for Dario Venn, from Mama Rosa's cafe to the docks.
// Each mission is a list of steps; a step is a place to reach, a car to steal,
// a wanted level to lose, or a delivery to make. The module owns the mission
// state machine, the objective text, the marker position and the dialogue lines.

import { MISSIONS } from './config.js';

// Fixed places in the city (street corners, so they are always reachable).
export const PLACES = {
  cafe: { x: -32, z: -96, name: "Mama Rosa's Cafe" },
  getaway: { x: 160, z: 32, name: 'The Getaway Car' },
  hideout: { x: -224, z: 224, name: 'The Hideout' },
  docks: { x: 272, z: -180, name: 'The Docks' },
  hospital: { x: 32, z: -224, name: 'Solmar General' },
};

const DIALOGUE = {
  meet: [
    ['Mama Rosa', 'Dario. Out already? Good. The Bay forgets no one — and neither do I.'],
    ['Mama Rosa', 'The Marinos took my delivery van. I need a driver with nothing to lose. That is you.'],
    ['Dario Venn', 'What is the job?'],
    ['Mama Rosa', 'First, wheels. There is a getaway car parked up on Coral Avenue. Go and take it.'],
  ],
  steal: [
    ['Dario Venn', 'That is the one. Chrome, fast, and nobody watching.'],
    ['Mama Rosa', 'Take it, Dario. The Bay Police will notice — that is the price of the job.'],
  ],
  lose: [
    ['Mama Rosa', 'You are hot now. Shake them. Get out of sight and stay quiet till the stars fade.'],
  ],
  deliver: [
    ['Mama Rosa', 'The package is in the trunk. The docks, east side, before the Marinos find it.'],
    ['Mama Rosa', 'They will send cars after you. Drive like the Bay is burning, Dario.'],
  ],
  done: [
    ['Mama Rosa', 'Delivered. Clean, fast, and the Marinos never saw your face.'],
    ['Mama Rosa', 'Solmar Bay is yours now, Dario. The city is open — spend the money well.'],
  ],
};

export function createMissions() {
  return {
    index: 0,
    step: 0,
    done: false,
    objective: 'Meet Mama Rosa at the cafe',
    marker: { ...PLACES.cafe },
    dialogue: null,
    dialogueLine: 0,
    stepData: {},
    cash: 0,
  };
}

/** Steps for the current mission, as { kind, x, z, radius, text }. */
function stepsFor(index) {
  switch (index) {
    case 0:
      return [{ kind: 'goto', x: PLACES.cafe.x, z: PLACES.cafe.z, radius: 4, text: 'Meet Mama Rosa at the cafe' }];
    case 1:
      return [{ kind: 'steal', x: PLACES.getaway.x, z: PLACES.getaway.z, radius: 5, text: 'Steal the getaway car on Coral Ave' }];
    case 2:
      return [{ kind: 'lose', x: PLACES.hideout.x, z: PLACES.hideout.z, radius: 6, text: 'Lose the wanted level — hide at the hideout' }];
    case 3:
      return [{ kind: 'goto', x: PLACES.docks.x, z: PLACES.docks.z, radius: 6, text: 'Deliver the package to the docks' }];
    default:
      return [];
  }
}

/** Start (or restart) the current mission: set its objective, marker and lines. */
export function startMission(missions, index) {
  missions.index = index;
  missions.step = 0;
  missions.done = index >= MISSIONS.length;
  const steps = stepsFor(index);
  if (steps.length === 0) {
    missions.objective = 'Free roam — Solmar Bay is yours';
    missions.marker = null;
    missions.dialogue = DIALOGUE.done;
    missions.dialogueLine = 0;
    return;
  }
  const step = steps[0];
  missions.objective = step.text;
  missions.marker = { x: step.x, z: step.z };
  const key = MISSIONS[index].id;
  missions.dialogue = DIALOGUE[key] || null;
  missions.dialogueLine = 0;
}

/** The dialogue lines showing now, or null. Advance with advanceDialogue(). */
export function currentDialogue(missions) {
  if (!missions.dialogue) return null;
  if (missions.dialogueLine >= missions.dialogue.length) return null;
  return missions.dialogue[missions.dialogueLine];
}

export function advanceDialogue(missions) {
  if (!missions.dialogue) return false;
  missions.dialogueLine += 1;
  if (missions.dialogueLine >= missions.dialogue.length) {
    missions.dialogue = null;
    return true;
  }
  return false;
}

/**
 * Advance the mission state machine. `world` carries the player, wanted level
 * and car state. Returns an event string when a mission completes or the story
 * ends ('mission' | 'story' | null).
 */
export function stepMissions(missions, world) {
  if (missions.done) return null;
  const steps = stepsFor(missions.index);
  const step = steps[missions.step];
  if (!step) return null;
  const px = world.player.x;
  const pz = world.player.z;
  let complete = false;
  if (step.kind === 'goto') {
    const d = Math.hypot(px - step.x, pz - step.z);
    complete = d < step.radius;
  } else if (step.kind === 'steal') {
    complete = world.player.car !== null && world.player.car.stolen;
  } else if (step.kind === 'lose') {
    const d = Math.hypot(px - step.x, pz - step.z);
    complete = world.wanted === 0 && d < step.radius;
  }
  if (!complete) return null;
  const reward = MISSIONS[missions.index].reward;
  world.cash += reward;
  missions.cash = reward;
  missions.step += 1;
  if (missions.step >= steps.length) {
    const next = missions.index + 1;
    if (next >= MISSIONS.length) {
      missions.done = true;
      missions.objective = 'Story complete — free roam';
      missions.marker = null;
      missions.dialogue = DIALOGUE.done;
      missions.dialogueLine = 0;
      return 'story';
    }
    startMission(missions, next);
    return 'mission';
  }
  return null;
}
