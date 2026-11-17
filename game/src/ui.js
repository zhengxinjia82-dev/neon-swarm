// All the screens drawn on top of the playfield: HUD, title, pause, upgrade cards and
// game over. Pure drawing: it reads state and paints pixels, and returns the upgrade
// cards' rectangles so the loop can hit-test clicks.
import { FIELD, FONT, PALETTE } from './config.js';
import { upgradeLevel } from './upgrades.js';

const CARD = { width: 300, height: 190, gap: 28, top: 252 };

export function cardRects() {
  const total = CARD.width * 3 + CARD.gap * 2;
  const left = (FIELD.width - total) / 2;
  return [0, 1, 2].map((index) => ({
    x: left + index * (CARD.width + CARD.gap),
    y: CARD.top,
    width: CARD.width,
    height: CARD.height,
  }));
}

function text(ctx, value, x, y, size, color, align = 'left') {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, width, height, edge) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = edge || PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}

export function drawHUD(ctx, state) {
  const player = state.player;
  text(ctx, `SCORE ${state.score}`, 24, 40, 26, PALETTE.text);
  text(ctx, `BEST ${state.best}`, 24, 68, 16, PALETTE.muted);
  text(ctx, `WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, 40, 26, PALETTE.text, 'center');
  // HP bar, top right.
  const barWidth = 220;
  const barX = FIELD.width - 24 - barWidth;
  const barY = 24;
  const ratio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = '#1a1d33';
  ctx.fillRect(barX, barY, barWidth, 18);
  ctx.fillStyle = ratio > 0.35 ? PALETTE.hp : PALETTE.hpLow;
  ctx.fillRect(barX, barY, barWidth * ratio, 18);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, 17);
  text(ctx, `HP ${Math.ceil(Math.max(0, player.hp))}`, barX + barWidth, barY + 38, 15, PALETTE.muted, 'right');
  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(barX - 22, barY + 9, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'SHIELD', barX - 38, barY + 38, 13, PALETTE.player, 'right');
  }
  text(ctx, 'M mute · P pause', FIELD.width - 24, FIELD.height - 18, 13, PALETTE.muted, 'right');
  if (state.banner) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerTimer * 2);
    text(ctx, state.banner, FIELD.width / 2, 150, 44, PALETTE.gold, 'center');
    ctx.restore();
  }
}

export function drawTitle(ctx, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.shadowColor = '#22e6ff';
  ctx.shadowBlur = 34;
  text(ctx, 'NEON SWARM', FIELD.width / 2, 218, 84, PALETTE.player, 'center');
  ctx.restore();
  text(ctx, 'Dodge the swarm. Blast the shapes. Survive.', FIELD.width / 2, 268, 24, PALETTE.text, 'center');
  text(ctx, 'WASD / arrows — move      Mouse — aim      Hold click — fire', FIELD.width / 2, 348, 20, PALETTE.muted, 'center');
  text(ctx, 'Between waves, pick 1 of 3 upgrades. P pauses. R restarts.', FIELD.width / 2, 382, 20, PALETTE.muted, 'center');
  text(ctx, 'Chasers hunt you · Shooters fire back · Splitters burst apart · Darts are fast', FIELD.width / 2, 416, 20, PALETTE.muted, 'center');
  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(Date.now() / 280);
  text(ctx, 'CLICK OR PRESS ENTER TO START', FIELD.width / 2, 500, 26, PALETTE.gold, 'center');
  ctx.restore();
  if (best > 0) text(ctx, `BEST ${best}`, FIELD.width / 2, 548, 20, PALETTE.muted, 'center');
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'PAUSED', FIELD.width / 2, 340, 56, PALETTE.text, 'center');
  text(ctx, 'Press P or click to resume', FIELD.width / 2, 392, 20, PALETTE.muted, 'center');
}

export function drawUpgrade(ctx, choices, player, hover) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'WAVE CLEARED', FIELD.width / 2, 150, 44, PALETTE.gold, 'center');
  text(ctx, 'Choose one upgrade — click a card or press 1, 2 or 3', FIELD.width / 2, 196, 20, PALETTE.text, 'center');
  const rects = cardRects();
  choices.forEach((choice, index) => {
    const rect = rects[index];
    const isHover = hover === index;
    ctx.save();
    if (isHover) {
      ctx.shadowColor = '#22e6ff';
      ctx.shadowBlur = 22;
    }
    panel(ctx, rect.x, rect.y, rect.width, rect.height, isHover ? PALETTE.player : PALETTE.panelEdge);
    ctx.restore();
    text(ctx, `${index + 1}`, rect.x + 18, rect.y + 34, 18, PALETTE.muted);
    text(ctx, choice.name, rect.x + 20, rect.y + 76, 25, PALETTE.text);
    const level = choice.id === 'repair' ? '' : `  Lv ${upgradeLevel(player, choice.id) + 1}/${choice.max === Infinity ? '∞' : choice.max}`;
    text(ctx, level, rect.x + 20, rect.y + 104, 15, PALETTE.muted);
    wrapText(ctx, choice.blurb, rect.x + 20, rect.y + 138, rect.width - 40, 18, PALETTE.muted);
  });
  return rects;
}

function wrapText(ctx, value, x, y, maxWidth, size, color) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const words = value.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += size + 6;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
}

export function drawGameOver(ctx, score, best, isNewBest) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.shadowColor = '#ff2d55';
  ctx.shadowBlur = 30;
  text(ctx, 'GAME OVER', FIELD.width / 2, 300, 72, '#ff2d55', 'center');
  ctx.restore();
  text(ctx, `SCORE ${score}`, FIELD.width / 2, 372, 34, PALETTE.text, 'center');
  if (isNewBest) text(ctx, 'NEW BEST!', FIELD.width / 2, 414, 24, PALETTE.gold, 'center');
  else text(ctx, `BEST ${best}`, FIELD.width / 2, 414, 24, PALETTE.muted, 'center');
  text(ctx, 'Press R or click to play again', FIELD.width / 2, 478, 22, PALETTE.text, 'center');
}
