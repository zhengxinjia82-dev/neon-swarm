// The between-wave upgrades: eight choices that change how the ship plays, plus a
// repair fallback when everything else is maxed out. Each tracks how many times it was
// taken on the player, so the offer never shows a maxed-out upgrade.
import { PLAYER } from './config.js';

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Fire',
    blurb: 'Fire 25% faster.',
    max: 5,
    apply(player) { player.fireInterval *= 0.8; },
  },
  {
    id: 'heavy',
    name: 'Heavy Rounds',
    blurb: 'Bullet damage +30%.',
    max: 5,
    apply(player) { player.damage *= 1.3; },
  },
  {
    id: 'multi',
    name: 'Multishot',
    blurb: '+1 projectile per shot.',
    max: 3,
    apply(player) { player.multishot += 1; },
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    blurb: 'Move 15% faster.',
    max: 4,
    apply(player) { player.speed *= 1.15; },
  },
  {
    id: 'hull',
    name: 'Reinforced Hull',
    blurb: 'Max HP +25 and heal 25.',
    max: 5,
    apply(player) {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'aegis',
    name: 'Aegis Shield',
    blurb: 'Block one hit each wave.',
    max: 1,
    apply(player) { player.shield = true; },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    blurb: 'Bullets pierce +1 enemy.',
    max: 3,
    apply(player) { player.pierce += 1; },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    blurb: '+25% damage, +10% fire rate, −10 max HP.',
    max: 3,
    apply(player) {
      player.damage *= 1.25;
      player.fireInterval *= 0.91;
      player.maxHp = Math.max(50, player.maxHp - 10);
      player.hp = Math.min(player.hp, player.maxHp);
    },
  },
];

export const REPAIR = {
  id: 'repair',
  name: 'Field Repair',
  blurb: 'Restore 30 HP now.',
  max: Infinity,
  apply(player) { player.hp = Math.min(player.maxHp, player.hp + 30); },
};

export function upgradeLevel(player, id) {
  return player.upgrades[id] || 0;
}

/** Three distinct offers the player has not maxed out (repair fills any gap). */
export function rollUpgrades(player, random) {
  const available = UPGRADES.filter((upgrade) => upgradeLevel(player, upgrade.id) < upgrade.max);
  for (let index = available.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [available[index], available[other]] = [available[other], available[index]];
  }
  const picks = available.slice(0, 3);
  while (picks.length < 3) picks.push(REPAIR);
  return picks;
}

export function applyUpgrade(player, upgrade) {
  player.upgrades[upgrade.id] = upgradeLevel(player, upgrade.id) + 1;
  upgrade.apply(player);
}

export { PLAYER };
