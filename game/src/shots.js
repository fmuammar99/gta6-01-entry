// The screenshot scenes behind ?shot=start|chase|foot|end. Each one plays
// the real rules forward from a fresh game for a fixed number of steps,
// steered by a simple autopilot (drive or walk toward the mission marker,
// shoot the nearest thug when one is close), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { roadCentre } from './world.js';
import { createGame, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './game.js';

function blankInput() {
  return {
    move: { x: 0, y: 0, sprint: false },
    steal: false, punch: false, fire: false,
    mouseDown: false, aiming: false,
    mouse: { x: 640, y: 360 },
  };
}

function autopilotInput(game) {
  const input = blankInput();
  const p = game.player;
  const stage = game.missions.currentStage();
  if (!stage) return input;
  const dx = stage.target.x - p.x;
  const dy = stage.target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (p.onFoot) {
    if (dist > 30) {
      input.move.x = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
      input.move.y = Math.abs(dy) > 24 ? Math.sign(dy) : 0;
      input.move.sprint = dist > 300;
    }
    // Shoot the nearest thug when the fight is on.
    let nearest = null;
    let nd = 420;
    for (const e of game.combat.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest) {
      input.aiming = true;
      input.mouse.x = 640 + (nearest.x - p.x);
      input.mouse.y = 360 + (nearest.y - p.y);
      input.mouseDown = nd < 380;
      if (nd < 60) input.punch = true;
    }
  } else {
    // Drive toward the marker along the road grid: follow the road we are
    // on toward the crossing road nearest the target, turn there, and
    // brake while the turn is sharp so the car makes the corner. The
    // heading is nudged back toward the road centre, so the car does not
    // drift into the buildings at the road edge.
    const p = game.player;
    const tx = stage.target.x;
    const ty = stage.target.y;
    const cx = roadCentre(p.x);
    const cy = roadCentre(p.y);
    const onV = Math.abs(p.x - cx) < 46;
    const onH = Math.abs(p.y - cy) < 46;
    let base;
    if (onH && Math.abs(ty - p.y) < 130) base = tx > p.x ? 0 : Math.PI;
    else if (onV && Math.abs(tx - p.x) < 130) base = ty > p.y ? Math.PI / 2 : -Math.PI / 2;
    else if (onH) {
      const txRoad = roadCentre(tx);
      if (Math.abs(txRoad - p.x) < 45) base = ty > p.y ? Math.PI / 2 : -Math.PI / 2;
      else base = txRoad > p.x ? 0 : Math.PI;
    } else if (onV) {
      const tyRoad = roadCentre(ty);
      if (Math.abs(tyRoad - p.y) < 45) base = tx > p.x ? 0 : Math.PI;
      else base = tyRoad > p.y ? Math.PI / 2 : -Math.PI / 2;
    } else {
      base = Math.atan2(cy - p.y, cx - p.x);
    }
    let want = base;
    if (base === 0) want = Math.max(-0.3, Math.min(0.3, -(p.y - cy) * 0.01));
    else if (base === Math.PI) want = Math.PI - Math.max(-0.3, Math.min(0.3, (p.y - cy) * 0.01));
    else if (base === Math.PI / 2) want = Math.PI / 2 + Math.max(-0.3, Math.min(0.3, (p.x - cx) * 0.01));
    else if (base === -Math.PI / 2) want = -Math.PI / 2 - Math.max(-0.3, Math.min(0.3, (p.x - cx) * 0.01));
    let diff = want - p.carAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.move.x = diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0;
    input.move.y = Math.abs(diff) > 0.5 && Math.abs(p.carSpeed) > 80 ? 1 : -1;
  }
  return input;
}

/**
 * Set `game` to the named scene and return the screen to draw over it.
 * Names: start (title over the live city), chase (a getaway in a stolen
 * car with police behind), foot (on foot at the mission marker), end
 * (mission one completed, banner up).
 */
export function stageShot(name, game) {
  if (name === 'start' || !name) {
    for (let i = 0; i < 6 / STEP; i += 1) game.step(STEP, blankInput());
    return { screen: SCREEN_TITLE };
  }
  game.startGame();
  if (name === 'chase') {
    // Mission two: the getaway. Put Raka in a car on the road south of
    // the cafe, heading south toward the garage, finish mission one so
    // the escape starts, and give him three stars with police on his tail.
    game.placeCar(688, 420, Math.PI / 2);
    game.missions.advance(); // pickup stage done
    game.missions.advance(); // delivery done: mission one complete
    game.player.cash += 150;
    game.police.addWanted(3, 'setup');
    for (let i = 0; i < 6 / STEP; i += 1) {
      game.step(STEP, autopilotInput(game));
      if (game.state.screen !== SCREEN_PLAY) break;
    }
    // Frame the chase: pull the two nearest police cars in behind the
    // player so the pursuit is visible in the shot.
    const p = game.player;
    const behind = [
      { dx: -Math.cos(p.carAngle) * 260, dy: -Math.sin(p.carAngle) * 260 },
      { dx: -Math.cos(p.carAngle) * 380 - 60, dy: -Math.sin(p.carAngle) * 380 + 60 },
    ];
    game.police.cars.forEach((car, i) => {
      if (i >= behind.length) return;
      car.x = p.x + behind[i].dx;
      car.y = p.y + behind[i].dy;
      car.angle = p.carAngle;
      car.speed = 320;
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // Mission one, on foot, a short walk from the cafe marker.
    const cafe = game.city.landmarks.cafe;
    game.teleport(cafe.x - 260, cafe.y + 180);
    for (let i = 0; i < 7 / STEP; i += 1) {
      game.step(STEP, autopilotInput(game));
      if (game.state.screen !== SCREEN_PLAY) break;
    }
    return { screen: SCREEN_PLAY };
  }
  // end: play mission one for real with the autopilot until it completes.
  for (let i = 0; i < 75 / STEP; i += 1) {
    game.step(STEP, autopilotInput(game));
    if (game.missions.state.done >= 1) break;
    if (game.state.screen !== SCREEN_PLAY) break;
  }
  return { screen: game.state.screen === SCREEN_VICTORY ? SCREEN_VICTORY : SCREEN_PLAY };
}

export function createShotGame(seed, name) {
  const game = createGame(seed);
  const staged = stageShot(name, game);
  return { game, screen: staged.screen };
}
