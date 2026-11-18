// TELUK SENJA — every tuning number and colour in one place.
// A top-down open-world crime game: one city, on foot and by car, with
// traffic, pedestrians, police, missions and combat. The renderer scales a
// fixed 1280x720 logical view to the window, so no rule here depends on
// the screen size. All names, places and story are original.
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** City geometry: a grid of blocks separated by roads. */
export const CITY = {
  width: 3200,
  height: 2240,
  pitch: 320, // block + road
  road: 96, // road width
  cols: 10,
  rows: 7,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 320,
  health: 100,
  startCash: 50,
  startAmmo: 12,
  maxAmmo: 48,
  punchDamage: 25,
  punchRange: 46,
  punchArc: 1.1,
  shotDamage: 34,
  bulletSpeed: 760,
  fireCooldown: 0.28,
  invulnerableAfterHit: 0.6,
};

export const CAR = {
  radius: 17,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  drag: 0.55,
  grip: 6.0,
  stealRange: 64,
};

export const TRAFFIC = {
  cars: 14,
  peds: 26,
  carSpeed: 150,
  carSpeedJitter: 50,
  pedSpeed: 55,
  pedSpeedJitter: 25,
};

export const POLICE = {
  maxCars: 5,
  chaseSpeed: 300,
  ramDamage: 12,
  ramCooldown: 0.9,
  spawnDistance: 700,
  // Seconds with no crime and out of sight before one star fades.
  coolDownPerStar: 9,
  bustTouchSeconds: 1.6,
};

export const WANTED = {
  steal: 1,
  hitPed: 1,
  hitCop: 2,
  speedingNearCop: 1,
};

/** Mission rewards, in dollars. */
export const REWARD = { m1: 150, m2: 250, m3: 400 };

export const PALETTE = {
  // Dusk over the bay: warm ground, dark asphalt, lit windows.
  ground: '#3d3a33',
  sidewalk: '#6f6a5e',
  road: '#2b2b31',
  roadEdge: '#4a4a52',
  lane: '#c9b458',
  park: '#3f6b3a',
  parkPath: '#8a7a52',
  water: '#1d4e5f',
  buildingRoof: ['#7a5a4a', '#5a6b7a', '#8a6a7a', '#6b7a5a', '#7a7a5a', '#9a7a4a'],
  buildingEdge: '#241f1c',
  windowLit: '#ffd98a',
  windowDark: '#2e3440',
  player: '#e8b13c',
  playerOutline: '#241f1c',
  carColors: ['#c94f43', '#4f7ac9', '#c9a44f', '#7ac94f', '#9a5fc9', '#d8d8d8', '#3a3a3a'],
  policeCar: '#e8e8e8',
  policeLight: ['#ff3b30', '#2f6bff'],
  pedColors: ['#e8e8e8', '#7ac9c9', '#c97a9a', '#9ac97a', '#c9c97a', '#8a8ac9'],
  marker: '#ffd23c',
  markerRing: '#ffffff',
  hudPanel: 'rgba(12, 12, 18, 0.72)',
  hudText: '#f2efe6',
  hudMuted: '#b8b2a4',
  star: '#ffd23c',
  starEmpty: '#5a5648',
  health: '#57c96b',
  healthLow: '#e5534b',
  cash: '#7ddc8a',
  title: '#ffd23c',
  subtitle: '#f2efe6',
};

/** Where best cash and progress are kept between visits (this browser only). */
export const BEST_KEY = 'teluk-senja.best.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
