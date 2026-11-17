// Neon Swarm: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 340,
  maxHp: 100,
  fireInterval: 0.25,
  damage: 10,
  bulletSpeed: 660,
  multishot: 1,
  pierce: 0,
  invulnerable: 1.0,
};

/** Per-kind enemy tuning: hp, speed, radius, contact damage and score. */
export const ENEMIES = {
  chaser: { hp: 20, speed: 125, radius: 16, damage: 12, score: 50, color: '#ff2d95' },
  shooter: { hp: 30, speed: 70, radius: 17, damage: 10, score: 100, color: '#ffd319' },
  splitter: { hp: 45, speed: 55, radius: 22, damage: 15, score: 150, color: '#39ff6a' },
  mini: { hp: 8, speed: 205, radius: 9, damage: 6, score: 25, color: '#ff2d95' },
  dart: { hp: 12, speed: 265, radius: 12, damage: 8, score: 75, color: '#ff9f1c' },
};

export const ENEMY_BULLET = { speed: 250, radius: 5, damage: 8 };

/** Wave shape: how many enemies, how fast they arrive, and which kinds may appear. */
export const WAVE = {
  baseCount: 6,
  perWave: 3,
  baseInterval: 0.95,
  intervalPerWave: 0.05,
  minInterval: 0.32,
  hpPerWave: 0.12,
  speedPerWave: 0.04,
};

export const PALETTE = {
  backdrop: '#05060f',
  grid: '#12142a',
  gridBright: '#1b1e3d',
  player: '#22e6ff',
  bullet: '#aef7ff',
  enemyBullet: '#ff5d5d',
  panel: '#0d1026',
  panelEdge: '#2a2f66',
  text: '#eef1ff',
  muted: '#8b93b8',
  hp: '#39ff6a',
  hpLow: '#ff2d55',
  gold: '#ffd319',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-swarm.best';
