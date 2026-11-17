// The game's rules and state, with no drawing and no browser in it: the ship, the swarm,
// the bullets, spawning, collisions, score, waves and upgrades. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound. The world owns the seeded random, so the same seed
// always plays the same game.
import { ENEMIES, ENEMY_BULLET, FIELD, PLAYER } from './config.js';
import { createPlayer, resetPlayer, updatePlayer } from './player.js';
import { createEnemy, KIND_SPLITTER, spawnQueueForWave, splitMinis, updateEnemy } from './enemies.js';
import { clearBullets, createBulletPool, spawnBullet, updateBullets } from './bullets.js';
import { burst, clearParticles, createParticles, floatText, shake, updateParticles } from './particles.js';
import { applyUpgrade, rollUpgrades } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_CLEAR = 2;
export const EVENT_OVER = 4;

export function createWorld(random, audio) {
  const player = createPlayer();
  const state = {
    player,
    enemies: [],
    playerBullets: createBulletPool(),
    enemyBullets: createBulletPool(),
    particles: createParticles(),
    score: 0,
    best: 0,
    wave: 0,
    spawnQueue: [],
    waveTime: 0,
    waveActive: false,
    banner: null,
    bannerTimer: 0,
    elapsed: 0,
    titleTimer: 0,
    died: false,
    overReported: false,
  };

  function reset() {
    resetPlayer(player);
    state.enemies = [];
    clearBullets(state.playerBullets);
    clearBullets(state.enemyBullets);
    clearParticles(state.particles);
    state.score = 0;
    state.wave = 0;
    state.spawnQueue = [];
    state.waveTime = 0;
    state.waveActive = false;
    state.banner = null;
    state.bannerTimer = 0;
    state.elapsed = 0;
    state.titleTimer = 0;
    state.died = false;
    state.overReported = false;
  }

  function startWave(number) {
    state.wave = number;
    state.waveTime = 0;
    state.spawnQueue = spawnQueueForWave(number, player, random);
    state.waveActive = true;
    if (player.upgrades.aegis) player.shield = true;
    state.banner = `WAVE ${number}`;
    state.bannerTimer = 1.4;
  }

  function offerUpgrades() {
    return rollUpgrades(player, random);
  }

  function pickUpgrade(choice) {
    applyUpgrade(player, choice);
    audio.upgrade();
    startWave(state.wave + 1);
  }

  function shootHook(x, y, angle) {
    spawnBullet(state.playerBullets, x, y, angle, player.bulletSpeed, player.damage, player.pierce, 4);
    audio.shoot();
    burst(state.particles, x, y, '#aef7ff', 2, 70, random);
  }

  function enemyShootHook(x, y, angle) {
    spawnBullet(state.enemyBullets, x, y, angle, ENEMY_BULLET.speed, ENEMY_BULLET.damage, 0, ENEMY_BULLET.radius);
  }

  function killEnemy(index) {
    const enemy = state.enemies[index];
    state.score += enemy.score;
    floatText(state.particles, enemy.x, enemy.y, `+${enemy.score}`, enemy.color);
    burst(state.particles, enemy.x, enemy.y, enemy.color, enemy.kind === KIND_SPLITTER ? 22 : 12, 260, random);
    if (enemy.kind === KIND_SPLITTER) {
      audio.explode();
      shake(state.particles, 4);
      state.enemies.splice(index, 1);
      for (const mini of splitMinis(enemy, state.wave, random)) state.enemies.push(mini);
    } else {
      if (enemy.kind === 'mini' || enemy.kind === 'dart') audio.hit();
      else audio.explode();
      state.enemies.splice(index, 1);
    }
  }

  function hurtPlayer(damage) {
    if (!player.alive || player.invuln > 0) return false;
    if (player.shield) {
      player.shield = false;
      player.invuln = 0.6;
      burst(state.particles, player.x, player.y, '#22e6ff', 14, 220, random);
      audio.hit();
      return true;
    }
    player.hp -= damage;
    player.invuln = PLAYER.invulnerable;
    shake(state.particles, 7);
    burst(state.particles, player.x, player.y, '#ff2d55', 16, 260, random);
    audio.playerHit();
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      state.died = true;
      burst(state.particles, player.x, player.y, '#22e6ff', 40, 380, random);
      burst(state.particles, player.x, player.y, '#ffffff', 20, 300, random);
      shake(state.particles, 10);
      audio.explode();
    }
    return true;
  }

  function collide() {
    let events = 0;
    // Player bullets against enemies.
    for (const bullet of state.playerBullets.list) {
      if (!bullet.active) continue;
      for (let index = 0; index < state.enemies.length; index += 1) {
        const enemy = state.enemies[index];
        if (bullet.hitId === enemy.id) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const reach = enemy.radius + bullet.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        enemy.hp -= bullet.damage;
        enemy.flash = 0.08;
        burst(state.particles, bullet.x, bullet.y, enemy.color, 3, 140, random);
        if (enemy.hp <= 0) killEnemy(index);
        else audio.hit();
        bullet.hitId = enemy.id;
        if (bullet.pierce > 0) bullet.pierce -= 1;
        else bullet.active = false;
        break;
      }
    }
    // Hostile bullets against the player.
    for (const bullet of state.enemyBullets.list) {
      if (!bullet.active) continue;
      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const reach = player.radius + bullet.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        bullet.active = false;
        if (hurtPlayer(bullet.damage)) events |= EVENT_HIT;
      }
    }
    // Enemies touching the player.
    for (const enemy of state.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const reach = player.radius + enemy.radius;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < reach) {
        if (hurtPlayer(enemy.damage)) events |= EVENT_HIT;
        const push = (reach - distance) / distance;
        enemy.x -= dx * push;
        enemy.y -= dy * push;
      }
    }
    return events;
  }

  /**
   * One fixed step of a live game. `input` carries move(), mouse, firing. Returns the
   * EVENT_* flags for what happened this step.
   */
  function update(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) state.banner = null;

    if (state.waveActive) {
      state.waveTime += dt;
      while (state.spawnQueue.length > 0 && state.spawnQueue[0].delay <= state.waveTime) {
        const spawn = state.spawnQueue.shift();
        state.enemies.push(createEnemy(spawn.kind, spawn.x, spawn.y, state.wave, random));
      }
    }

    if (player.alive) updatePlayer(player, dt, input, shootHook);
    for (const enemy of state.enemies) updateEnemy(enemy, dt, player, enemyShootHook, random);
    updateBullets(state.playerBullets, dt);
    updateBullets(state.enemyBullets, dt);
    events |= collide();
    updateParticles(state.particles, dt);

    if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      state.score += 100 * state.wave;
      state.banner = 'WAVE CLEARED';
      state.bannerTimer = 1.6;
      audio.waveClear();
      events |= EVENT_CLEAR;
    }
    if (state.died && !state.overReported) {
      state.overReported = true;
      events |= EVENT_OVER;
    }
    return events;
  }

  /**
   * The title screen's backdrop: a harmless swarm drifts around a slow-orbiting point,
   * never firing and never hurting anyone.
   */
  function updateTitle(dt) {
    state.elapsed += dt;
    state.titleTimer -= dt;
    if (state.titleTimer <= 0 && state.enemies.length < 7) {
      state.titleTimer = 1.4;
      const kinds = ['chaser', 'dart', 'shooter', 'splitter'];
      const kind = kinds[Math.floor(random() * kinds.length)];
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random() * FIELD.width; y = -30; }
      else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
      else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else { x = -30; y = random() * FIELD.height; }
      state.enemies.push(createEnemy(kind, x, y, 1, random));
    }
    const ghost = {
      x: FIELD.width / 2 + Math.cos(state.elapsed * 0.3) * 190,
      y: FIELD.height / 2 + Math.sin(state.elapsed * 0.23) * 130,
    };
    for (const enemy of state.enemies) updateEnemy(enemy, dt, ghost, () => {}, random);
    updateParticles(state.particles, dt);
  }

  return {
    state,
    random,
    reset,
    startWave,
    offerUpgrades,
    pickUpgrade,
    update,
    updateTitle,
    /** Place one enemy of `kind` at `x, y` (used by the screenshot scenes). */
    spawnEnemy(kind, x, y, wave) {
      const enemy = createEnemy(kind, x, y, wave, random);
      state.enemies.push(enemy);
      return enemy;
    },
  };
}

export { ENEMIES };
