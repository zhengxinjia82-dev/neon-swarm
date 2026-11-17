// Bullet pools: one fixed pool per side, allocated once at boot, so a frame never
// allocates. A player bullet remembers the last enemy it hit, so piercing shots do not
// strike the same enemy twice.
import { FIELD } from './config.js';

const POOL_SIZE = 256;

export function createBulletPool() {
  const list = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    list.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, radius: 4, hitId: -1 });
  }
  return { list };
}

export function spawnBullet(pool, x, y, angle, speed, damage, pierce, radius) {
  for (let index = 0; index < pool.list.length; index += 1) {
    const bullet = pool.list[index];
    if (bullet.active) continue;
    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.damage = damage;
    bullet.pierce = pierce;
    bullet.radius = radius;
    bullet.hitId = -1;
    return bullet;
  }
  return null;
}

export function updateBullets(pool, dt) {
  for (const bullet of pool.list) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < -40 || bullet.x > FIELD.width + 40 || bullet.y < -40 || bullet.y > FIELD.height + 40) {
      bullet.active = false;
    }
  }
}

export function clearBullets(pool) {
  for (const bullet of pool.list) bullet.active = false;
}
