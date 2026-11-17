// The swarm: four geometric kinds, each with its own behaviour, plus the spawn queue
// that feeds a wave. Enemies only move and (for shooters) fire; collisions, damage and
// death are the world's job.
import { ENEMIES, ENEMY_BULLET, FIELD, WAVE } from './config.js';

export const KIND_CHASER = 'chaser';
export const KIND_SHOOTER = 'shooter';
export const KIND_SPLITTER = 'splitter';
export const KIND_MINI = 'mini';
export const KIND_DART = 'dart';

let nextId = 1;

export function createEnemy(kind, x, y, wave, random) {
  const tuning = ENEMIES[kind];
  const hpScale = 1 + WAVE.hpPerWave * (wave - 1);
  const speedScale = Math.min(1.5, 1 + WAVE.speedPerWave * (wave - 1));
  const angle = random() * Math.PI * 2;
  return {
    id: nextId,
    kind,
    x,
    y,
    vx: Math.cos(angle) * tuning.speed * speedScale,
    vy: Math.sin(angle) * tuning.speed * speedScale,
    hp: Math.round(tuning.hp * hpScale),
    maxHp: Math.round(tuning.hp * hpScale),
    radius: tuning.radius,
    speed: tuning.speed * speedScale,
    damage: tuning.damage,
    score: tuning.score,
    color: tuning.color,
    flash: 0,
    fireTimer: 1.5 + random() * 1.2,
    strafeDir: random() < 0.5 ? -1 : 1,
    strafeTimer: 1 + random(),
    phase: random() * Math.PI * 2,
    elapsed: 0,
  };
}

/** Where a wave's enemies enter: a random edge point at least 220 away from the player. */
function spawnPoint(player, random) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = random() * FIELD.width; y = -30; }
    else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
    else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
    else { x = -30; y = random() * FIELD.height; }
    if (Math.hypot(x - player.x, y - player.y) > 220) return { x, y };
  }
  return { x: FIELD.width / 2, y: -30 };
}

/**
 * A wave's spawn queue: kinds with a delay after the previous spawn. The mix widens as
 * the waves go on: darts and shooters from wave 2, splitters from wave 3.
 */
export function spawnQueueForWave(wave, player, random) {
  const count = WAVE.baseCount + WAVE.perWave * wave;
  const interval = Math.max(WAVE.minInterval, WAVE.baseInterval - WAVE.intervalPerWave * (wave - 1));
  const queue = [];
  let delay = 0.4;
  for (let index = 0; index < count; index += 1) {
    const roll = random() * 100;
    let kind = KIND_CHASER;
    if (wave >= 3 && roll < 18) kind = KIND_SPLITTER;
    else if (wave >= 2 && roll < 38) kind = KIND_SHOOTER;
    else if (wave >= 2 && roll < 62) kind = KIND_DART;
    const point = spawnPoint(player, random);
    queue.push({ kind, x: point.x, y: point.y, delay });
    delay += interval * (0.7 + random() * 0.6);
  }
  return queue;
}

/** A splitter bursts into three fast minis where it died. */
export function splitMinis(enemy, wave, random) {
  const minis = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + random() * 0.8;
    const mini = createEnemy(KIND_MINI, enemy.x + Math.cos(angle) * 18, enemy.y + Math.sin(angle) * 18, wave, random);
    mini.vx = Math.cos(angle) * mini.speed;
    mini.vy = Math.sin(angle) * mini.speed;
    minis.push(mini);
  }
  return minis;
}

/** One fixed step of one enemy's behaviour. `fireBullet(x, y, angle)` spawns a hostile shot. */
export function updateEnemy(enemy, dt, player, fireBullet, random) {
  enemy.elapsed += dt;
  if (enemy.flash > 0) enemy.flash -= dt;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;

  if (enemy.kind === KIND_CHASER || enemy.kind === KIND_SPLITTER || enemy.kind === KIND_MINI) {
    const wobble = enemy.kind === KIND_CHASER ? Math.sin(enemy.elapsed * 3 + enemy.phase) * 0.35 : 0;
    const angle = Math.atan2(ny, nx) + wobble;
    const desiredX = Math.cos(angle) * enemy.speed;
    const desiredY = Math.sin(angle) * enemy.speed;
    const turn = Math.min(1, 3.5 * dt);
    enemy.vx += (desiredX - enemy.vx) * turn;
    enemy.vy += (desiredY - enemy.vy) * turn;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  } else if (enemy.kind === KIND_DART) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    if (enemy.x < enemy.radius || enemy.x > FIELD.width - enemy.radius) {
      enemy.vx = -enemy.vx;
      enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
    }
    if (enemy.y < enemy.radius || enemy.y > FIELD.height - enemy.radius) {
      enemy.vy = -enemy.vy;
      enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));
    }
  } else if (enemy.kind === KIND_SHOOTER) {
    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir = -enemy.strafeDir;
      enemy.strafeTimer = 1.2 + random() * 1.4;
    }
    let moveX = 0;
    let moveY = 0;
    if (distance > 320) { moveX = nx; moveY = ny; }
    else if (distance < 220) { moveX = -nx; moveY = -ny; }
    else { moveX = -ny * enemy.strafeDir; moveY = nx * enemy.strafeDir; }
    enemy.vx = moveX * enemy.speed;
    enemy.vy = moveY * enemy.speed;
    enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x + enemy.vx * dt));
    enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y + enemy.vy * dt));
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && distance < 620) {
      enemy.fireTimer = 2.4;
      const spread = (random() - 0.5) * 0.12;
      fireBullet(enemy.x, enemy.y, Math.atan2(dy, dx) + spread);
    }
  }
}

export { ENEMY_BULLET };
