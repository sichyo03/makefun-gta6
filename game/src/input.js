// Keyboard and pointer input. Held keys give movement; one-shot presses (confirm,
// pause, enter car, shoot, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse
// drags the camera; a click fires the weapon (on foot) and advances dialogue.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;
  let dragX = 0;
  let dragY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  function has(keys) {
    for (const code of keys) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Forward/back and left/right in [-1, 1], and whether the run key is held. */
    move() {
      const fwd = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
      const strafe = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      return { fwd, strafe, run: has(RUN) };
    },
    /** Camera drag since the last call, in pixels; the caller turns it into radians. */
    takeDrag() {
      const taken = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
