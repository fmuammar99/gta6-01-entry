// TELUK SENJA — the game itself. One createGame(seed) owns the city,
// traffic, police, missions, combat, player and camera, and advances them
// one fixed 1/60 s step at a time. It never draws (see render.js) and
// never touches the DOM except localStorage for the best result. step()
// takes a normalised input snapshot and returns event flags the caller
// turns into sound.
import { BEST_KEY, CAR, CITY, PLAYER, POLICE, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './world.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export const EVENT_PICKUP = 1;
export const EVENT_CASH = 2;
export const EVENT_SHOT = 4;
export const EVENT_PUNCH = 8;
export const EVENT_HIT = 16;
export const EVENT_KILL = 32;
export const EVENT_MISSION = 64;
export const EVENT_OVER = 128;
export const EVENT_CRASH = 256;
export const EVENT_STEAL = 512;
export const EVENT_RAM = 1024;
export const EVENT_PLAYER_HIT = 2048;

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return { bestCash: 0, missionsDone: 0 };
    const parsed = JSON.parse(raw);
    return { bestCash: parsed.bestCash | 0, missionsDone: parsed.missionsDone | 0 };
  } catch {
    return { bestCash: 0, missionsDone: 0 };
  }
}

export function createGame(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const traffic = createTraffic(random, city);
  const police = createPolice(random);
  const missions = createMissions(city);
  const combat = createCombat(random);

  const player = {
    x: city.landmarks.cafe.x, y: city.landmarks.cafe.y + 60,
    angle: 0, faceAngle: -Math.PI / 2,
    hp: PLAYER.health, ammo: PLAYER.startAmmo, cash: PLAYER.startCash,
    onFoot: true, car: null, carSpeed: 0, carAngle: 0,
    invuln: 0, punchCooldown: 0, moving: false,
  };

  const camera = { x: player.x - VIEW.width / 2, y: player.y - VIEW.height / 2 };
  const particles = [];
  const floaters = [];
  const state = {
    screen: SCREEN_TITLE,
    overReason: '',
    time: 0,
    best: loadBest(),
    stats: { kills: 0, crimes: 0, missions: 0 },
    dialogue: null, // { text, timer }
    banner: null, // { title, sub, timer }
    shake: 0,
    attractT: 0,
    muted: false,
  };

  function saveBest() {
    state.best.bestCash = Math.max(state.best.bestCash, player.cash);
    state.best.missionsDone = Math.max(state.best.missionsDone, missions.state.done);
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(state.best));
    } catch { /* private mode: the game still plays */ }
  }

  function addParticles(x, y, n, color, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const v = (speed || 120) * (0.4 + random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + random() * 0.3, max: 0.7, color, size: 2 + random() * 3 });
    }
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, color: color || '#f2efe6', life: 1.4 });
  }

  function startGame() {
    player.x = city.landmarks.cafe.x;
    player.y = city.landmarks.cafe.y + 60;
    player.hp = PLAYER.health;
    player.ammo = PLAYER.startAmmo;
    player.cash = PLAYER.startCash;
    player.onFoot = true;
    player.car = null;
    player.carSpeed = 0;
    player.invuln = 0;
    police.clear();
    combat.enemies.length = 0;
    combat.bullets.length = 0;
    particles.length = 0;
    floaters.length = 0;
    state.time = 0;
    state.stats = { kills: 0, crimes: 0, missions: 0 };
    state.screen = SCREEN_PLAY;
    state.overReason = '';
    state.banner = null;
    missions.start();
    saveBest();
  }

  function endGame(reason) {
    state.screen = SCREEN_OVER;
    state.overReason = reason;
    state.banner = null;
    saveBest();
  }

  function commitCrime(kind, n) {
    police.addWanted(n, kind);
    state.stats.crimes += 1;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of traffic.cars) {
      if (car === player.car) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function stealCar() {
    const car = nearestCar(CAR.stealRange);
    if (!car) return false;
    car.parked = false;
    player.car = car;
    player.onFoot = false;
    player.carAngle = car.angle;
    player.carSpeed = 0;
    player.x = car.x;
    player.y = car.y;
    commitCrime('steal', 1);
    addParticles(car.x, car.y, 8, '#ffd23c', 90);
    floater(car.x, car.y - 24, 'MOBIL DICURI!', '#ffd23c');
    return true;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    car.parked = true;
    car.angle = player.carAngle;
    player.car = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(player.carAngle + Math.PI / 2) * 30;
    player.y = car.y + Math.sin(player.carAngle + Math.PI / 2) * 30;
    city.resolveCircle(player, PLAYER.radius);
    player.carSpeed = 0;
  }

  function damagePlayer(amount, source) {
    if (player.invuln > 0) return;
    player.hp -= amount;
    player.invuln = PLAYER.invulnerableAfterHit;
    state.shake = Math.max(state.shake, 7);
    addParticles(player.x, player.y, 10, '#e5534b', 140);
    if (player.hp <= 0) {
      player.hp = 0;
      endGame(source === 'busted' ? 'BUSTED' : 'WASTED');
    }
  }

  function stepOnFoot(dt, input, events) {
    const mv = input.move;
    const len = Math.hypot(mv.x, mv.y);
    const speed = mv.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    player.moving = len > 0;
    if (len > 0) {
      const nx = player.x + (mv.x / len) * speed * dt;
      const ny = player.y + (mv.y / len) * speed * dt;
      if (!city.blocked(nx, player.y, PLAYER.radius)) player.x = nx;
      if (!city.blocked(player.x, ny, PLAYER.radius)) player.y = ny;
      player.faceAngle = Math.atan2(mv.y, mv.x);
    }
    // Face the mouse when aiming (mouse moved or button held).
    if (input.mouseDown || input.aiming) {
      const wx = camera.x + input.mouse.x;
      const wy = camera.y + input.mouse.y;
      player.faceAngle = Math.atan2(wy - player.y, wx - player.x);
    }
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (input.punch && player.punchCooldown <= 0) {
      player.punchCooldown = 0.35;
      const hit = combat.playerPunch(player);
      addParticles(player.x + Math.cos(player.faceAngle) * 30, player.y + Math.sin(player.faceAngle) * 30, 6, '#e8e8e8', 100);
      if (hit.length) {
        for (const e of hit) {
          if (e.hp <= 0) { events |= EVENT_KILL; state.stats.kills += 1; floater(e.x, e.y - 20, '+$40', '#7ddc8a'); player.cash += 40; }
          else events |= EVENT_HIT;
        }
      } else events |= EVENT_PUNCH;
    }
    if ((input.mouseDown || input.fire) && combat.playerShoot(player, player.faceAngle)) {
      events |= EVENT_SHOT;
      addParticles(player.x + Math.cos(player.faceAngle) * 26, player.y + Math.sin(player.faceAngle) * 26, 4, '#ffd98a', 160);
    }
    if (input.steal) {
      if (stealCar()) events |= EVENT_STEAL;
    }
    return events;
  }

  function stepDriving(dt, input, events) {
    const car = player.car;
    const mv = input.move;
    const forward = Math.cos(player.carAngle);
    const right = Math.sin(player.carAngle);
    // Project velocity onto the car's heading: arcade car, speed is scalar.
    if (mv.y < 0) player.carSpeed += CAR.accel * dt;
    else if (mv.y > 0) player.carSpeed -= CAR.brake * dt;
    else player.carSpeed -= player.carSpeed * CAR.drag * dt;
    if (Math.abs(player.carSpeed) < 4 && mv.y === 0) player.carSpeed = 0;
    player.carSpeed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, player.carSpeed));
    // Steering still bites at low speed, so tight turns at intersections work.
    const steer = mv.x * CAR.turnRate * dt * (0.35 + 0.65 * Math.min(1, Math.abs(player.carSpeed) / 150)) * (player.carSpeed < 0 ? -1 : 1);
    player.carAngle += steer;
    const nx = player.x + Math.cos(player.carAngle) * player.carSpeed * dt;
    const ny = player.y + Math.sin(player.carAngle) * player.carSpeed * dt;
    const hitWall = city.blocked(nx, ny, CAR.radius);
    if (hitWall) {
      if (Math.abs(player.carSpeed) > 200) { events |= EVENT_CRASH; state.shake = Math.max(state.shake, 6); damagePlayer(6, 'crash'); }
      player.carSpeed *= -0.25;
    } else {
      player.x = nx;
      player.y = ny;
    }
    // Keep the stolen car glued to the player; it is the player's car now.
    car.x = player.x;
    car.y = player.y;
    car.angle = player.carAngle;
    car.axis = Math.abs(forward) > Math.abs(right) ? 'h' : 'v';
    car.dir = (car.axis === 'h' ? forward : right) > 0 ? 1 : -1;
    // Collisions with traffic cars: a shove and a crunch.
    for (const other of traffic.cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        other.x += (dx / d) * push;
        other.y += (dy / d) * push;
        if (Math.abs(player.carSpeed) > 150) {
          events |= EVENT_CRASH;
          player.carSpeed *= 0.55;
          addParticles(other.x, other.y, 8, '#c9c9c9', 120);
        }
      }
    }
    // Hitting a pedestrian while driving is a crime.
    for (const ped of traffic.peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - player.x, ped.y - player.y);
      if (d < 30 && Math.abs(player.carSpeed) > 60) {
        ped.down = 4;
        ped.tx = ped.x; ped.ty = ped.y;
        commitCrime('hitPed', 1);
        events |= EVENT_CRASH;
        floater(ped.x, ped.y - 20, 'WANTED +1', '#ff6b5e');
        addParticles(ped.x, ped.y, 10, '#e5534b', 130);
      }
    }
    // Exhaust puffs at speed.
    if (Math.abs(player.carSpeed) > 240 && random() < 0.35) {
      particles.push({
        x: player.x - Math.cos(player.carAngle) * 20, y: player.y - Math.sin(player.carAngle) * 20,
        vx: -Math.cos(player.carAngle) * 40, vy: -Math.sin(player.carAngle) * 40,
        life: 0.5, max: 0.5, color: '#8a8a8a', size: 3,
      });
    }
    if (input.steal) exitCar();
    return events;
  }

  function stepPlay(dt, input) {
    let events = 0;
    state.time += dt;
    if (player.invuln > 0) player.invuln -= dt;

    if (player.onFoot) events = stepOnFoot(dt, input, events);
    else events = stepDriving(dt, input, events);
    if (state.screen !== SCREEN_PLAY) return events;

    // Traffic and pedestrians keep moving; peds flee when the player is a danger.
    const danger = !player.onFoot && Math.abs(player.carSpeed) > 120;
    traffic.stepCars(dt, player, player.car);
    traffic.stepPeds(dt, player, danger || police.wanted > 0);

    // Police chase and ram; a long touch on foot busts the player.
    const pres = police.step(dt, player, Math.abs(player.carSpeed), !player.onFoot);
    if (pres.rammed) {
      damagePlayer(POLICE.ramDamage, 'ram');
      events |= EVENT_RAM;
      if (state.screen !== SCREEN_PLAY) return events;
    }
    if (pres.busted) {
      endGame('BUSTED');
      return EVENT_OVER;
    }

    // Combat: bullets and thugs.
    combat.step(dt, player, (x, y, r) => city.blocked(x, y, r), (kind, enemy) => {
      if (kind === 'kill') {
        state.stats.kills += 1;
        player.cash += 40;
        floater(enemy.x, enemy.y - 20, '+$40', '#7ddc8a');
        addParticles(enemy.x, enemy.y, 12, '#e5534b', 150);
      } else if (kind === 'playerHit') {
        damagePlayer(9, 'shot');
      }
    });
    // Combat events are folded into the returned flags by the counters above.
    if (state.screen !== SCREEN_PLAY) return events | EVENT_OVER;

    // Pickups.
    for (const p of city.pickups) {
      if (p.taken) continue;
      p.bob += dt * 3;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 34) {
        p.taken = true;
        if (p.kind === 'cash') { player.cash += 25; floater(p.x, p.y - 18, '+$25', '#7ddc8a'); events |= EVENT_CASH; }
        else if (p.kind === 'health') { player.hp = Math.min(PLAYER.health, player.hp + 30); floater(p.x, p.y - 18, '+30 HP', '#57c96b'); events |= EVENT_PICKUP; }
        else { player.ammo = Math.min(PLAYER.maxAmmo, player.ammo + 12); floater(p.x, p.y - 18, '+12 AMMO', '#ffd98a'); events |= EVENT_PICKUP; }
        addParticles(p.x, p.y, 8, '#ffd23c', 90);
      }
    }

    // Mission progress.
    const stage = missions.currentStage();
    if (stage) {
      const d = Math.hypot(stage.target.x - player.x, stage.target.y - player.y);
      if (stage.id === 'fight') {
        if (combat.enemies.length === 0) {
          const res = missions.advance();
          if (res && res.kind === 'mission') { events |= EVENT_MISSION; onMissionComplete(res); }
        }
      } else if (d < stage.radius) {
        if (stage.id === 'warehouse') combat.spawnThugs(stage.target, 3);
        const res = missions.advance();
        if (res) {
          if (res.kind === 'mission') { events |= EVENT_MISSION; onMissionComplete(res); }
          else if (res.kind === 'stage' && missions.currentStage() && missions.currentStage().id === 'fight') {
            combat.spawnThugs(stage.target, 3);
          }
        }
      }
    }
    if (missions.state.allDone && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_VICTORY;
      saveBest();
      return events | EVENT_MISSION;
    }

    // Mission two starts hot: the getaway begins with two stars.
    if (missions.state.index === 1 && missions.state.stage === 0 && police.wanted === 0 && !missions.state.m2Hot) {
      missions.state.m2Hot = true;
      commitCrime('speedingNearCop', 2);
    }

    // Dialogue lines, one at a time.
    if (!state.dialogue && missions.state.sayQueue.length > 0) {
      state.dialogue = { text: missions.state.sayQueue.shift(), timer: 3.4 };
    }
    if (state.dialogue) {
      state.dialogue.timer -= dt;
      if (state.dialogue.timer <= 0) state.dialogue = null;
    }
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }

    // Particles and floaters.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.y -= 34 * dt; f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    // Camera follows the player, clamped to the city.
    const tx = player.x - VIEW.width / 2;
    const ty = player.y - VIEW.height / 2;
    camera.x += (tx - camera.x) * Math.min(1, dt * 5);
    camera.y += (ty - camera.y) * Math.min(1, dt * 5);
    camera.x = Math.max(0, Math.min(CITY.width - VIEW.width, camera.x));
    camera.y = Math.max(0, Math.min(CITY.height - VIEW.height, camera.y));
    return events;
  }

  function onMissionComplete(res) {
    player.cash += res.reward;
    state.stats.missions += 1;
    state.banner = { ...(missions.state.banner || { title: 'MISI SELESAI', sub: `${res.name} — +$${res.reward}` }), timer: 3.6 };
    saveBest();
  }

  function stepTitle(dt) {
    state.attractT += dt;
    traffic.stepCars(dt, player, null);
    traffic.stepPeds(dt, { x: -9999, y: -9999 }, false);
    // Slow pan across the city so the title screen feels alive.
    const cx = CITY.width / 2 + Math.cos(state.attractT * 0.08) * 700;
    const cy = CITY.height / 2 + Math.sin(state.attractT * 0.05) * 420;
    camera.x = Math.max(0, Math.min(CITY.width - VIEW.width, cx - VIEW.width / 2));
    camera.y = Math.max(0, Math.min(CITY.height - VIEW.height, cy - VIEW.height / 2));
  }

  /** One fixed step. `input` is the normalised snapshot from main.js. */
  function step(dt, input) {
    if (state.screen === SCREEN_TITLE) { stepTitle(dt); return 0; }
    if (state.screen === SCREEN_PLAY) return stepPlay(dt, input);
    return 0;
  }

  return {
    state, player, camera, city, traffic, police, missions, combat,
    particles, floaters,
    step, startGame, endGame, saveBest,
    // Test / shot helpers: put the player somewhere useful.
    teleport(x, y) { player.x = x; player.y = y; city.resolveCircle(player, PLAYER.radius); },
    giveCar() {
      const car = nearestCar(100000);
      if (car) {
        car.parked = false;
        player.car = car; player.onFoot = false;
        player.carAngle = car.angle; player.carSpeed = 0;
        player.x = car.x; player.y = car.y;
      }
    },
    /** Put the player in the nearest car, placed on a road at (x, y) facing `angle`. */
    placeCar(x, y, angle) {
      const car = nearestCar(100000);
      if (!car) return;
      car.parked = false;
      car.x = x; car.y = y; car.angle = angle;
      car.axis = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? 'h' : 'v';
      car.dir = (car.axis === 'h' ? Math.cos(angle) : Math.sin(angle)) > 0 ? 1 : -1;
      player.car = car; player.onFoot = false;
      player.carAngle = angle; player.carSpeed = 0;
      player.x = x; player.y = y;
    },
  };
}
