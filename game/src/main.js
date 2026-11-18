// Boot and the fixed-timestep loop. Reads ?seed= and ?shot= from the URL,
// runs the simulation at 60 steps a second whatever the display rate,
// draws each frame, maps input actions to game screens and sounds, and
// sets window.__shotReady once a screenshot scene is staged so an
// automated screenshotter knows the frame is final.
import { STEP, VIEW } from './config.js';
import { createGame, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_KILL, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_PUNCH, EVENT_RAM, EVENT_SHOT, EVENT_STEAL } from './game.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RESTART, ACTION_STEAL, createInput } from './input.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;
const shotName = params.get('shot');

const game = createGame(seed);
const audio = createAudio();
const input = createInput(canvas);

let lastStatus = '';
function setStatus(text) {
  if (text === lastStatus) return;
  lastStatus = text;
  if (statusEl) statusEl.textContent = text;
}

function resize() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  const w = Math.floor(VIEW.width * scale);
  const h = Math.floor(VIEW.height * scale);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.style.left = Math.floor((window.innerWidth - w) / 2) + 'px';
  canvas.style.top = Math.floor((window.innerHeight - h) / 2) + 'px';
}
window.addEventListener('resize', resize);
resize();

function playEvents(events) {
  if (events & EVENT_SHOT) audio.shot();
  if (events & EVENT_PUNCH) audio.punch();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_KILL) { audio.hit(); audio.cash(); }
  if (events & EVENT_CASH) audio.cash();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_CRASH) audio.crash();
  if (events & EVENT_RAM) audio.crash();
  if (events & EVENT_STEAL) audio.click();
  if (events & EVENT_MISSION) audio.mission();
  if (events & EVENT_OVER) audio.fail();
}

function snapshotInput() {
  const mv = input.move();
  const scaleX = canvas.width / canvas.getBoundingClientRect().width;
  const scaleY = canvas.height / canvas.getBoundingClientRect().height;
  const m = input.mouse();
  return {
    move: mv,
    steal: false,
    punch: false,
    fire: false,
    mouseDown: input.mouseDown,
    aiming: input.mouseDown,
    mouse: { x: m.x * scaleX, y: m.y * scaleY },
  };
}

let shotReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  const actions0 = input.takeActions();
  let actions = actions0;
  if (actions & ACTION_MUTE) game.state.muted = audio.toggleMute();
  if (actions & ACTION_CONFIRM) audio.unlock();

  const screen = game.state.screen;
  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.click();
      game.startGame();
    }
  } else if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) {
      game.state.screen = SCREEN_PAUSE;
    } else if (actions & ACTION_RESTART) {
      game.startGame();
    }
  } else if (screen === SCREEN_PAUSE) {
    if (actions & ACTION_PAUSE) game.state.screen = SCREEN_PLAY;
    else if (actions & ACTION_RESTART) game.startGame();
  } else if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
    if (actions & (ACTION_CONFIRM | ACTION_RESTART)) game.startGame();
  }

  // Fixed steps: accumulate real time, simulate in 1/60 s slices.
  if (!frame.last) frame.last = now;
  let dt = (now - frame.last) / 1000;
  frame.last = now;
  if (dt > 0.25) dt = 0.25;
  frame.acc = (frame.acc || 0) + dt;
  let guard = 0;
  while (frame.acc >= STEP && guard < 8) {
    frame.acc -= STEP;
    guard += 1;
    const snap = snapshotInput();
    if (game.state.screen === SCREEN_PLAY) {
      snap.steal = Boolean(actions & ACTION_STEAL);
      snap.punch = Boolean(actions & ACTION_PUNCH);
      snap.fire = input.mouseDown;
      const events = game.step(STEP, snap);
      playEvents(events);
    } else {
      game.step(STEP, snap);
    }
    actions = 0;
  }

  // Continuous sounds follow the live state.
  const driving = game.state.screen === SCREEN_PLAY && !game.player.onFoot;
  audio.engine(driving ? Math.abs(game.player.carSpeed) / 520 : 0, driving);
  audio.siren(game.state.screen === SCREEN_PLAY && game.police.wanted > 0);

  draw(ctx, game);
  const p = game.player;
  setStatus(
    game.state.screen === SCREEN_TITLE
      ? 'Teluk Senja — tekan Enter untuk mulai'
      : `${game.missions.objective()} — uang $${p.cash}, HP ${Math.ceil(p.hp)}, wanted ${game.police.wanted}`,
  );
}

// Screenshot scenes: stage the game synchronously, then run the loop.
if (shotName) {
  import('./shots.js').then(({ stageShot }) => {
    stageShot(shotName, game);
    window.__shotReady = true;
    shotReady = true;
    requestAnimationFrame(frame);
  }).catch(() => {
    window.__shotReady = true;
    requestAnimationFrame(frame);
  });
} else {
  window.__game = game;
  window.__shotReady = false;
  requestAnimationFrame(frame);
}

// Exposed for play-testing: the live game and a way to read its state.
window.__game = game;
window.__input = input;
