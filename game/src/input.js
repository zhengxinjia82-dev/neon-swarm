// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start,
// pause, restart, mute, upgrade picks) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The pointer gives the
// aim point in field coordinates and a held button means "fire".

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const KEY_SETS = {
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  confirm: new Set(['Space', 'Enter']),
  pause: new Set(['KeyP', 'Escape']),
  restart: new Set(['KeyR']),
  mute: new Set(['KeyM']),
  pick1: new Set(['Digit1', 'Numpad1']),
  pick2: new Set(['Digit2', 'Numpad2']),
  pick3: new Set(['Digit3', 'Numpad3']),
};

export function createInput(canvas, toField) {
  const held = { up: false, down: false, left: false, right: false };
  const mouse = { x: 640, y: 360, down: false };
  let actions = 0;
  let click = null;

  function press(code) {
    if (KEY_SETS.up.has(code)) held.up = true;
    else if (KEY_SETS.down.has(code)) held.down = true;
    else if (KEY_SETS.left.has(code)) held.left = true;
    else if (KEY_SETS.right.has(code)) held.right = true;
    else if (KEY_SETS.confirm.has(code)) actions |= ACTION_CONFIRM;
    else if (KEY_SETS.pause.has(code)) actions |= ACTION_PAUSE;
    else if (KEY_SETS.restart.has(code)) actions |= ACTION_RESTART;
    else if (KEY_SETS.mute.has(code)) actions |= ACTION_MUTE;
    else if (KEY_SETS.pick1.has(code)) actions |= ACTION_PICK_1;
    else if (KEY_SETS.pick2.has(code)) actions |= ACTION_PICK_2;
    else if (KEY_SETS.pick3.has(code)) actions |= ACTION_PICK_3;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (press(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (KEY_SETS.up.has(event.code)) held.up = false;
    else if (KEY_SETS.down.has(event.code)) held.down = false;
    else if (KEY_SETS.left.has(event.code)) held.left = false;
    else if (KEY_SETS.right.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
    mouse.down = false;
  });

  function trackPointer(event) {
    const point = toField(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
  }

  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouse.down = true;
    click = { x: mouse.x, y: mouse.y };
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** Normalised steering vector from the held movement keys. */
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** Aim point in field coordinates. */
    mouse,
    /** True while the pointer button (or Space) is held: hold to keep firing. */
    get firing() {
      return mouse.down;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click's field position since the last call, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
