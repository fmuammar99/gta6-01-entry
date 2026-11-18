// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (confirm, pause, steal, punch, mute, restart) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims the pistol on foot.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM | ACTION_STEAL;
      event.preventDefault();
    } else if (event.code === 'Space') {
      if (!event.repeat) actions |= ACTION_CONFIRM | ACTION_PUNCH;
      event.preventDefault();
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RESTART;
    }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  function has(codes) {
    for (const c of codes) if (held.has(c)) return true;
    return false;
  }

  return {
    /** -1/0/1 for each axis, from held keys. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
        sprint: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    get mouseDown() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    /** Test helper: pretend a key is held. */
    __hold(code, on) { if (on) held.add(code); else held.delete(code); },
    __press(flag) { actions |= flag; },
  };
}
