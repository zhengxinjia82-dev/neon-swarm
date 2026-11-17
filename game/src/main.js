// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, upgrade, paused and game over.
//
// ?seed=N fixes the falling pattern. ?shot=title|play|late|over (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CLEAR, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';
import { cardRects } from './ui.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, choices: [], hover: -1, isNewBest: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let isNewBest = false;
  let choices = [];
  let hover = -1;
  let accumulator = 0;
  let last = performance.now();

  // The debug handle the playtest drives: the world and the screen, nothing else.
  window.__neon = {
    world,
    get screen() {
      return screen;
    },
    get score() {
      return world.state.score;
    },
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.startWave(1);
    isNewBest = false;
    screen = SCREEN_PLAY;
    accumulator = 0;
    // Drain the click that started the game: it must not leak into the first
    // upgrade screen and pick a card the player never chose.
    input.takeClick();
    announce('Playing. Wave 1.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      isNewBest = true;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function cardAt(point) {
    if (!point) return -1;
    const rects = cardRects();
    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
        return index;
      }
    }
    return -1;
  }

  function pickChoice(index) {
    if (index < 0 || index >= choices.length) return;
    world.pickUpgrade(choices[index]);
    choices = [];
    screen = SCREEN_PLAY;
    announce(`Playing. Wave ${world.state.wave}.`);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.updateTitle(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.update(STEP, input);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_CLEAR) {
      choices = world.offerUpgrades();
      screen = SCREEN_UPGRADE;
      // Drain clicks from play (the player was firing): only a fresh click on a
      // card may pick an upgrade.
      input.takeClick();
      announce('Wave cleared. Choose an upgrade.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      const click = input.takeClick();
      if (actions & ACTION_PICK_1) pickChoice(0);
      else if (actions & ACTION_PICK_2) pickChoice(1);
      else if (actions & ACTION_PICK_3) pickChoice(2);
      else if (click) pickChoice(cardAt(click));
      hover = cardAt({ x: input.mouse.x, y: input.mouse.y });
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
        audio.unlock();
        audio.click();
        startGame();
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, choices, hover, isNewBest });
  }

  // Leaving the tab pauses a running game rather than letting the swarm close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // Any gesture unlocks audio for the session.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
  window.addEventListener('keydown', () => audio.unlock(), { once: false });

  announce('Neon Swarm. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
