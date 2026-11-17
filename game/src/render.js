// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon shapes glow through shadowBlur; the grid, the ship and the swarm are all
// drawn here, while the panels and text live in ui.js.
import { FIELD, FONT, PALETTE } from './config.js';
import { shakeOffset } from './particles.js';
import { drawGameOver, drawHUD, drawPaused, drawTitle, drawUpgrade } from './ui.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function pathShape(ctx, kind, x, y, angle, radius) {
  ctx.beginPath();
  if (kind === 'chaser' || kind === 'mini') {
    for (let index = 0; index < 3; index += 1) {
      const a = angle + (index / 3) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else if (kind === 'shooter') {
    for (let index = 0; index < 4; index += 1) {
      const a = angle + (index / 4) * Math.PI * 2 + Math.PI / 4;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else if (kind === 'splitter') {
    for (let index = 0; index < 6; index += 1) {
      const a = angle + (index / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else {
    // dart: a diamond
    ctx.moveTo(x + Math.cos(angle) * radius * 1.4, y + Math.sin(angle) * radius * 1.4);
    ctx.lineTo(x + Math.cos(angle + Math.PI / 2) * radius * 0.6, y + Math.sin(angle + Math.PI / 2) * radius * 0.6);
    ctx.lineTo(x - Math.cos(angle) * radius * 1.4, y - Math.sin(angle) * radius * 1.4);
    ctx.lineTo(x + Math.cos(angle - Math.PI / 2) * radius * 0.6, y + Math.sin(angle - Math.PI / 2) * radius * 0.6);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  function toField(clientX, clientY) {
    return {
      x: (clientX * view.ratio - view.x) / view.scale,
      y: (clientY * view.ratio - view.y) / view.scale,
    };
  }

  function drawBackground() {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 64; x < FIELD.width; x += 64) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 64; y < FIELD.height; y += 64) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    context.strokeStyle = PALETTE.gridBright;
    context.beginPath();
    for (let x = 256; x < FIELD.width; x += 256) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 256; y < FIELD.height; y += 256) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
  }

  function drawEnemy(enemy) {
    const angle = Math.atan2(enemy.vy, enemy.vx);
    context.save();
    context.shadowColor = enemy.color;
    context.shadowBlur = 16;
    context.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    pathShape(context, enemy.kind, enemy.x, enemy.y, enemy.kind === 'shooter' ? enemy.elapsed * 0.6 : angle, enemy.radius);
    context.fill();
    context.restore();
    if (enemy.hp < enemy.maxHp && enemy.maxHp >= 30) {
      const width = enemy.radius * 2;
      context.fillStyle = '#1a1d33';
      context.fillRect(enemy.x - width / 2, enemy.y + enemy.radius + 6, width, 4);
      context.fillStyle = enemy.color;
      context.fillRect(enemy.x - width / 2, enemy.y + enemy.radius + 6, width * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawPlayer(player, elapsed) {
    if (!player.alive) return;
    context.save();
    if (player.invuln > 0 && Math.floor(elapsed * 14) % 2 === 0) context.globalAlpha = 0.35;
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 20;
    context.fillStyle = PALETTE.player;
    pathShape(context, 'chaser', player.x, player.y, player.angle, player.radius + 4);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#062a33';
    pathShape(context, 'chaser', player.x, player.y, player.angle, player.radius - 7);
    context.fill();
    context.restore();
    if (player.shield) {
      context.save();
      context.strokeStyle = PALETTE.player;
      context.globalAlpha = 0.7;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  function drawBullets(state) {
    for (const bullet of state.playerBullets.list) {
      if (!bullet.active) continue;
      context.save();
      context.shadowColor = PALETTE.bullet;
      context.shadowBlur = 10;
      context.strokeStyle = PALETTE.bullet;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
      context.restore();
    }
    for (const bullet of state.enemyBullets.list) {
      if (!bullet.active) continue;
      context.save();
      context.shadowColor = PALETTE.enemyBullet;
      context.shadowBlur = 10;
      context.fillStyle = PALETTE.enemyBullet;
      context.beginPath();
      context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawParticles(state) {
    for (const spark of state.particles.sparks) {
      if (!spark.active) continue;
      context.save();
      context.globalAlpha = Math.max(0, spark.life / spark.maxLife);
      context.strokeStyle = spark.color;
      context.lineWidth = spark.size;
      context.beginPath();
      context.moveTo(spark.x, spark.y);
      context.lineTo(spark.x - spark.vx * 0.03, spark.y - spark.vy * 0.03);
      context.stroke();
      context.restore();
    }
    context.font = `bold 18px ${FONT}`;
    context.textAlign = 'center';
    for (const text of state.particles.texts) {
      if (!text.active) continue;
      context.save();
      context.globalAlpha = Math.max(0, text.life / text.maxLife);
      context.fillStyle = text.color;
      context.fillText(text.str, text.x, text.y);
      context.restore();
    }
  }

  /**
   * Paint the world under `screen`. `ui` carries what the screens need: best, the
   * upgrade choices and hover index, and whether the game-over score is a new best.
   */
  function draw(state, screen, ui) {
    const width = canvas.width;
    const height = canvas.height;
    context.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, width / view.ratio, height / view.ratio);
    context.translate(view.x / view.ratio, view.y / view.ratio);
    context.scale(view.scale / view.ratio, view.scale / view.ratio);
    const offset = shakeOffset(state.particles);
    context.translate(offset.x, offset.y);
    drawBackground();
    for (const enemy of state.enemies) drawEnemy(enemy);
    drawPlayer(state.player, state.elapsed);
    drawBullets(state);
    drawParticles(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
      drawHUD(context, state);
    }
    if (screen === SCREEN_TITLE) drawTitle(context, ui.best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(context, ui.choices, state.player, ui.hover);
    else if (screen === SCREEN_PAUSED) drawPaused(context);
    else if (screen === SCREEN_OVER) drawGameOver(context, state.score, ui.best, ui.isNewBest);
  }

  return { draw, resize, toField, view };
}
