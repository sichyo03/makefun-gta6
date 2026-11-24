// Solmar Bay v2 — keyboard and mouse input. Tracks held keys, edge-triggered
// presses (so one key tap is one action), and mouse drag for the camera.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;
export const ACTION_RADIO = 16;
export const ACTION_HORN = 32;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { down: false, dx: 0, dy: 0, x: 0, y: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onBlur() {
    keys.clear();
  }
  function onMouseDown(event) {
    mouse.down = true;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }
  function onMouseMove(event) {
    if (!mouse.down) return;
    mouse.dx += event.movementX || 0;
    mouse.dy += event.movementY || 0;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(code) {
    return keys.has(code);
  }

  /** Movement axes in [-1, 1]: x = strafe right, y = forward. */
  function axes() {
    let x = 0;
    let y = 0;
    if (held('KeyW') || held('ArrowUp')) y += 1;
    if (held('KeyS') || held('ArrowDown')) y -= 1;
    if (held('KeyD')) x += 1;
    if (held('KeyA')) x -= 1;
    if (held('ArrowLeft')) x -= 1;
    if (held('ArrowRight')) x += 1;
    return { x, y };
  }

  /** Camera yaw input from arrow keys and mouse drag. */
  function look() {
    let yaw = 0;
    if (held('ArrowLeft')) yaw += 1.6;
    if (held('ArrowRight')) yaw -= 1.6;
    yaw += mouse.dx * 0.004;
    mouse.dx = 0;
    mouse.dy = 0;
    return yaw;
  }

  /** Edge-triggered actions since the last call; clears only the action
   * codes it consumed, so digit presses stay available for takeDigit. */
  function takeActions() {
    let actions = 0;
    if (pressed.has('Enter') || pressed.has('Space')) {
      actions |= ACTION_CONFIRM;
      pressed.delete('Enter');
      pressed.delete('Space');
    }
    if (pressed.has('KeyP') || pressed.has('Escape')) {
      actions |= ACTION_PAUSE;
      pressed.delete('KeyP');
      pressed.delete('Escape');
    }
    if (pressed.has('KeyE')) { actions |= ACTION_INTERACT; pressed.delete('KeyE'); }
    if (pressed.has('KeyR')) { actions |= ACTION_RELOAD; pressed.delete('KeyR'); }
    if (pressed.has('KeyC')) { actions |= ACTION_RADIO; pressed.delete('KeyC'); }
    if (pressed.has('KeyH')) { actions |= ACTION_HORN; pressed.delete('KeyH'); }
    return actions;
  }

  /** A digit key 1..6 pressed since the last call (weapons 1-3, radio 4-6). */
  function takeDigit() {
    for (const code of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return Number(code.slice(-1));
      }
    }
    return 0;
  }

  function sprinting() {
    return held('ShiftLeft') || held('ShiftRight');
  }

  function firing() {
    return mouse.down || held('KeyF');
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  return { keys, held, axes, look, takeActions, takeDigit, sprinting, firing, mouse, destroy };
}
