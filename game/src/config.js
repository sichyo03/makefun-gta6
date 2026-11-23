// Solmar Bay — every tuning number, colour and layout constant in one place.
// The city is a street grid: streets run at x/z = -224, -160, -96, -32, 32, 96, 160, 224,
// each 14 wide, with building blocks between them. The beach is south (z > 256), the
// docks are east (x > 256). All distances are metres; the simulation steps at 1/60 s.

export const STEP = 1 / 60;

export const CITY = {
  half: 288,
  streetSpacing: 64,
  streetWidth: 14,
  streets: [-224, -160, -96, -32, 32, 96, 160, 224],
  blockHalf: 25,
  beachZ: 256,
  docksX: 256,
};

export const PLAYER = {
  radius: 0.6,
  walkSpeed: 7,
  runSpeed: 11.5,
  health: 100,
  turnSpeed: 9,
};

export const CAR = {
  accel: 17,
  brake: 34,
  maxSpeed: 38,
  maxReverse: 12,
  steer: 0.55,
  grip: 5.5,
  length: 4.4,
  width: 2.0,
  health: 100,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 22;

export const WANTED = {
  max: 5,
  decayDelay: 18,
  decayInterval: 12,
  policeCars: [0, 1, 2, 2, 3, 4],
  // seconds a cop must stay touching the player on foot before the bust lands
  bustTime: 2.5,
};

export const MISSIONS = [
  { id: 'meet', title: 'Meet Mama Rosa', reward: 500 },
  { id: 'steal', title: 'Steal the Getaway', reward: 800 },
  { id: 'lose', title: 'Lose the Heat', reward: 1200 },
  { id: 'deliver', title: 'The Docks Run', reward: 2000 },
];

export const PALETTE = {
  sky: '#ffb36b',
  skyTop: '#7ec8e3',
  fog: '#f7b98a',
  ground: '#3d3a38',
  asphalt: '#33302e',
  sidewalk: '#8d8578',
  sand: '#e8cf9a',
  water: '#2e7f9e',
  grass: '#5d8a4a',
  building: ['#c98f6b', '#b8a88f', '#8fa3b8', '#a87f6d', '#7d8a6d', '#c9b18a'],
  windowLit: '#ffd98a',
  windowDark: '#2c3440',
  player: '#2f7fd0',
  police: '#1c2733',
  taxi: '#f2c230',
  hudText: '#ffffff',
  hudPanel: 'rgba(12, 14, 20, 0.62)',
  wanted: '#ffcf3d',
  marker: '#ffd21f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';

/** The city is Solmar Bay. The player is Dario Venn, a driver fresh out of the
 *  county lockup. The fixer is Mama Rosa. None of these names, places or the
 *  story below come from any commercial game. */
export const STORY = {
  city: 'Solmar Bay',
  player: 'Dario Venn',
  fixer: 'Mama Rosa',
};
