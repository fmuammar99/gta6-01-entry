// The wanted level and the police who answer it. Stars rise when a crime
// is committed (stealing a car, hitting a pedestrian, ramming a police car)
// and fade one at a time when the player stays quiet and out of sight.
// Police cars spawn on nearby roads, chase the player and ram them; on
// foot, a touch that lasts long enough busts the player instead.
import { CITY, POLICE, WANTED } from './config.js';
import { isRoad, roadCentre } from './world.js';
import { randRange } from './random.js';

export function createPolice(random) {
  const cars = [];
  let wanted = 0;
  let quietTimer = 0;
  let bustTimer = 0;
  let speedTimer = 0;

  function addWanted(n, reason) {
    if (n <= 0) return;
    wanted = Math.min(5, wanted + n);
    quietTimer = 0;
    return reason;
  }

  function spawnCarNear(px, py) {
    // A road point roughly POLICE.spawnDistance away from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const angle = random() * Math.PI * 2;
      const x = px + Math.cos(angle) * POLICE.spawnDistance;
      const y = py + Math.sin(angle) * POLICE.spawnDistance;
      if (x < 80 || y < 80 || x > CITY.width - 80 || y > CITY.height - 80) continue;
      if (!isRoad(x, y)) continue;
      cars.push({
        x, y, angle: Math.atan2(py - y, px - x),
        speed: 0, ramCooldown: 0, sirenPhase: random() * Math.PI * 2,
      });
      return;
    }
    // Fallback: the nearest road centre to the player, offset along it.
    cars.push({
      x: roadCentre(px + 400), y: roadCentre(py), angle: 0,
      speed: 0, ramCooldown: 0, sirenPhase: 0,
    });
  }

  function step(dt, player, playerSpeed, inCar) {
    // Keep the number of police cars matched to the wanted level.
    const want = wanted;
    while (cars.length < want) spawnCarNear(player.x, player.y);
    while (cars.length > want) cars.pop();

    // Speeding past a police car draws attention.
    if (inCar && playerSpeed > 380) {
      speedTimer += dt;
      if (speedTimer > 2.5) {
        addWanted(WANTED.speedingNearCop, 'speeding');
        speedTimer = 0;
      }
    } else speedTimer = 0;

    // Quiet time fades one star at a time.
    if (wanted > 0) {
      quietTimer += dt;
      if (quietTimer > POLICE.coolDownPerStar) {
        wanted -= 1;
        quietTimer = 0;
      }
    }

    let busted = false;
    let rammed = false;
    for (const car of cars) {
      car.sirenPhase += dt * 6;
      // Steer toward the player, with a little wobble so chases look alive.
      const target = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = target - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = POLICE.chaseSpeed + wanted * 12;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = Math.max(20, Math.min(CITY.width - 20, car.x));
      car.y = Math.max(20, Math.min(CITY.height - 20, car.y));
      if (car.ramCooldown > 0) car.ramCooldown -= dt;
      const dx = car.x - player.x;
      const dy = car.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 34 && car.ramCooldown <= 0) {
        car.ramCooldown = POLICE.ramCooldown;
        rammed = true;
        // Bounce the police car off so it does not sit on top of the player.
        car.x += (dx / (dist || 1)) * 26;
        car.y += (dy / (dist || 1)) * 26;
        car.speed *= 0.4;
      }
      if (!inCar && dist < 30) {
        bustTimer += dt;
        if (bustTimer > POLICE.bustTouchSeconds) busted = true;
      }
    }
    if (cars.length === 0 || wanted === 0) bustTimer = Math.max(0, bustTimer - dt * 2);
    return { busted, rammed };
  }

  function clear() {
    wanted = 0;
    quietTimer = 0;
    bustTimer = 0;
    cars.length = 0;
  }

  return {
    cars,
    get wanted() { return wanted; },
    addWanted,
    step,
    clear,
  };
}

/** How many stars a crime of the given kind adds. */
export function wantedFor(kind) {
  return WANTED[kind] ?? 0;
}
