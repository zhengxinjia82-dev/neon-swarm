// The screenshot scenes behind ?shot=title|play|late|over. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a real game looks like and the same seed always gives the same
// frame. The 'over' pilot flies into the swarm and never fires, so it is caught out as a
// hurried player is.
import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 5;
const LATE_SECONDS = 5;
const OVER_NORMAL_SECONDS = 20;
const OVER_LIMIT_SECONDS = 90;

/** Steer away from close threats, drift to the centre, aim at the nearest enemy. */
function autopilot(state, suicidal) {
  const player = state.player;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  }
  let moveX = 0;
  let moveY = 0;
  if (suicidal && nearest) {
    moveX = (nearest.x - player.x) / nearestDistance;
    moveY = (nearest.y - player.y) / nearestDistance;
  } else {
    for (const enemy of state.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 210) {
        const weight = (210 - distance) / 210 / distance;
        moveX += dx * weight;
        moveY += dy * weight;
      }
    }
    moveX += (FIELD.width / 2 - player.x) / 900;
    moveY += (FIELD.height / 2 - player.y) / 900;
    const length = Math.hypot(moveX, moveY);
    if (length > 0.01) {
      moveX /= length;
      moveY /= length;
    }
  }
  return {
    move() {
      return { x: moveX, y: moveY };
    },
    mouse: nearest ? { x: nearest.x, y: nearest.y } : { x: player.x, y: player.y - 100 },
    firing: !suicidal && nearest !== null,
  };
}

function runSteps(world, seconds, pilot, stopEvents) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const events = world.update(STEP, pilot(world.state));
    // A cleared wave starts the next one at once, so the frame never runs dry.
    if (events & EVENT_CLEAR) {
      const choices = world.offerUpgrades();
      world.pickUpgrade(choices[0]);
    }
    if (stopEvents && (events & stopEvents)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. Any unknown name stages the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    world.startWave(1);
    // Play into wave 2 and stop once the swarm is thick: wave 1 alone is too thin
    // for a cover frame (the pilot clears it in seconds).
    const maxSteps = Math.floor(30 / STEP);
    for (let index = 0; index < maxSteps; index += 1) {
      const events = world.update(STEP, autopilot(world.state, false));
      if (events & EVENT_CLEAR) {
        const choices = world.offerUpgrades();
        world.pickUpgrade(choices[0]);
      }
      if (events & EVENT_OVER) break;
      if (world.state.wave >= 2 && world.state.enemies.length >= 5) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'late') {
    world.reset();
    // A stocked ship in the thick of wave 5: upgrades first, then a dense swarm placed
    // around it, then a few seconds of real play.
    const player = world.state.player;
    player.multishot = 2;
    player.damage = 18;
    player.fireInterval = 0.18;
    player.pierce = 1;
    world.startWave(5);
    world.state.spawnQueue = [];
    const kinds = ['chaser', 'chaser', 'dart', 'shooter', 'splitter', 'dart', 'chaser', 'shooter', 'splitter', 'dart', 'chaser', 'shooter', 'mini', 'mini', 'splitter', 'dart'];
    for (const kind of kinds) {
      let x = 0;
      let y = 0;
      do {
        x = 80 + world.random() * (FIELD.width - 160);
        y = 80 + world.random() * (FIELD.height - 160);
      } while (Math.hypot(x - player.x, y - player.y) < 260);
      world.spawnEnemy(kind, x, y, 5);
    }
    runSteps(world, LATE_SECONDS, (state) => autopilot(state, false), 0);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'over') {
    world.reset();
    world.startWave(1);
    // Score something first, then fly into the swarm and die: the game-over screen
    // should show a score the player earned, not a zero.
    runSteps(world, OVER_NORMAL_SECONDS, (state) => autopilot(state, false), EVENT_OVER);
    if (world.state.player.alive) {
      runSteps(world, OVER_LIMIT_SECONDS, (state) => autopilot(state, true), EVENT_OVER);
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  world.reset();
  for (let index = 0; index < TITLE_SECONDS / STEP; index += 1) world.updateTitle(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}

export { EVENT_CLEAR };
