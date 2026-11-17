// The player's ship: its stats, movement, aiming and firing. Damage is applied by the
// world (it owns the shield, invulnerability and particles); this file only moves the
// ship and asks the world to spawn bullets through the `shoot` hook.
import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    shield: false,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    damage: PLAYER.damage,
    bulletSpeed: PLAYER.bulletSpeed,
    multishot: PLAYER.multishot,
    pierce: PLAYER.pierce,
    fireTimer: 0,
    invuln: 0,
    alive: true,
    upgrades: {},
  };
}

export function resetPlayer(player) {
  const fresh = createPlayer();
  Object.assign(player, fresh);
}

/**
 * Move with the held keys, aim at the pointer, and fire while the button is held.
 * `shoot(x, y, angle)` is the world's hook: it spawns one bullet and plays its sound.
 */
export function updatePlayer(player, dt, input, shoot) {
  if (!player.alive) return;
  const move = input.move();
  player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + move.x * player.speed * dt));
  player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + move.y * player.speed * dt));
  player.angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
  if (player.invuln > 0) player.invuln -= dt;
  player.fireTimer -= dt;
  if (input.firing && player.fireTimer <= 0) {
    player.fireTimer = player.fireInterval;
    const count = player.multishot;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * 0.13;
      shoot(player.x + Math.cos(player.angle) * (player.radius + 6), player.y + Math.sin(player.angle) * (player.radius + 6), player.angle + offset);
    }
  }
}
