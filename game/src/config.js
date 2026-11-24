// Solmar Bay v2 — shared tuning and constants for the whole game.
// One place for every number the systems agree on: city size, speeds,
// wanted rules, weapons, payouts. Nothing here imports three.js.
export const WORLD = {
  blocks: 10, // city is a 10x10 grid of blocks
  blockPitch: 46, // block (36) + road (10)
  blockSize: 36,
  roadWidth: 10,
  // city spans -230..230; beach south (z > 230), docks east (x > 230)
  half: 230,
  beachZ: 252,
  dockX: 252,
  waterLevel: 0.4,
};

export const COLOURS = {
  skyDay: 0x8ec9ee,
  skyDusk: 0xff9a5c,
  skyNight: 0x0b1026,
  sunDay: 0xfff2d8,
  ground: 0x3a3f45,
  road: 0x23262b,
  sidewalk: 0x8a8f96,
  sand: 0xe8d29a,
  water: 0x1d6f8f,
  grass: 0x4d8a4a,
};

export const PLAYER = {
  walkSpeed: 7.5,
  sprintSpeed: 11,
  radius: 0.9,
  maxHealth: 100,
  interactRange: 4.5,
};

export const CAR = {
  accel: 16,
  brake: 30,
  maxSpeed: 38, // sport car
  maxReverse: 12,
  turnRate: 2.1,
  radius: 2.2,
};

export const WANTED = {
  decayPerSecond: 0.06, // stars fall slowly when unseen
  stealCar: 1,
  shootCop: 2,
  killPed: 1,
  killCop: 2,
  maxStars: 5,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, spread: 0.012, range: 70, mag: 12, reload: 1.1, auto: false, pellets: 1, kick: 0.6 },
  smg: { name: 'SMG', damage: 16, rate: 0.085, spread: 0.05, range: 48, mag: 32, reload: 1.4, auto: true, pellets: 1, kick: 0.35 },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.95, spread: 0.11, range: 26, mag: 6, reload: 2.1, auto: false, pellets: 6, kick: 1.4 },
};

export const MISSION_PAYOUTS = [500, 800, 1200, 2000, 2500, 3000, 3500, 3000, 4000, 10000];

export const SAVE_KEY = 'solmar-bay-v2-save';
export const BEST_KEY = 'solmar-bay-v2-best';
export const STEP = 1 / 60;
