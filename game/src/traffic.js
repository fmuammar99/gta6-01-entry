// Traffic cars and pedestrians. Cars drive along the road grid, turning at
// intersections; pedestrians stroll the sidewalks and run away from danger.
// Neither module knows about missions or the player beyond the positions it
// is handed each step, so the same code drives the title screen's ambient
// city and the live game.
import { CITY, TRAFFIC } from './config.js';
import { isRoad, roadCentre } from './world.js';
import { randInt, randPick, randRange } from './random.js';

const CAR_W = 34;
const CAR_H = 18;

function randomRoadPoint(random) {
  // A point on a road: pick a random vertical or horizontal road.
  if (random() < 0.5) {
    const col = randInt(random, 0, CITY.cols);
    return { x: col * CITY.pitch + CITY.road / 2, y: randRange(random, 60, CITY.height - 60), axis: 'v' };
  }
  const row = randInt(random, 0, CITY.rows);
  return { x: randRange(random, 60, CITY.width - 60), y: row * CITY.pitch + CITY.road / 2, axis: 'h' };
}

export function createTraffic(random, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const p = randomRoadPoint(random);
    const dir = random() < 0.5 ? 1 : -1;
    const lane = (random() < 0.5 ? -1 : 1) * 20;
    cars.push({
      x: p.axis === 'v' ? p.x + lane : p.x,
      y: p.axis === 'h' ? p.y + lane : p.y,
      axis: p.axis,
      dir,
      speed: TRAFFIC.carSpeed + randRange(random, -TRAFFIC.carSpeedJitter, TRAFFIC.carSpeedJitter),
      color: randPick(random, ['#c94f43', '#4f7ac9', '#c9a44f', '#7ac94f', '#9a5fc9', '#d8d8d8', '#3a3a3a']),
      angle: p.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      parked: false,
      brake: 0,
    });
  }
  // A few parked cars the player can steal from the kerb.
  for (let i = 0; i < 4; i += 1) {
    const p = randomRoadPoint(random);
    cars.push({
      x: p.x, y: p.y, axis: p.axis, dir: 1, speed: 0,
      color: randPick(random, ['#c94f43', '#4f7ac9', '#c9a44f', '#7ac94f']),
      angle: p.axis === 'v' ? Math.PI / 2 : 0, parked: true, brake: 0,
    });
  }

  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const col = randInt(random, 0, CITY.cols);
    const row = randInt(random, 0, CITY.rows);
    const x = col * CITY.pitch + randRange(random, CITY.road - 14, CITY.pitch - 10);
    const y = row * CITY.pitch + randRange(random, CITY.road - 14, CITY.pitch - 10);
    peds.push({
      x, y, tx: x, ty: y,
      speed: TRAFFIC.pedSpeed + randRange(random, -TRAFFIC.pedSpeedJitter, TRAFFIC.pedSpeedJitter),
      color: randPick(random, ['#e8e8e8', '#7ac9c9', '#c97a9a', '#9ac97a', '#c9c97a', '#8a8ac9']),
      fleeing: false, down: 0, walkPhase: random() * Math.PI * 2,
    });
  }

  function pickPedTarget(ped) {
    // A nearby sidewalk point: just off a road, inside a block edge.
    const col = Math.max(0, Math.min(CITY.cols - 1, Math.floor(ped.x / CITY.pitch)));
    const row = Math.max(0, Math.min(CITY.rows - 1, Math.floor(ped.y / CITY.pitch)));
    const side = random();
    if (side < 0.5) {
      ped.tx = col * CITY.pitch + randRange(random, CITY.road - 12, CITY.pitch - 12);
      ped.ty = row * CITY.pitch + randRange(random, CITY.road + 6, CITY.pitch - 12);
    } else {
      ped.tx = col * CITY.pitch + randRange(random, CITY.road + 6, CITY.pitch - 12);
      ped.ty = row * CITY.pitch + randRange(random, CITY.road - 12, CITY.pitch - 12);
    }
  }

  function stepCars(dt, player, playerCar) {
    for (const car of cars) {
      if (car.parked || car === playerCar) continue;
      // Slow down for the car ahead on the same road.
      car.brake = 0;
      for (const other of cars) {
        if (other === car || other.parked) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
        const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
        if (ahead > 0 && ahead < 70 && side < 30) { car.brake = 1; break; }
      }
      const v = car.brake ? 0 : car.speed;
      if (car.axis === 'v') car.y += car.dir * v * dt;
      else car.x += car.dir * v * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const px = ((car.x % CITY.pitch) + CITY.pitch) % CITY.pitch;
      const py = ((car.y % CITY.pitch) + CITY.pitch) % CITY.pitch;
      const nearCross = Math.min(Math.abs(px - CITY.road / 2), Math.abs(py - CITY.road / 2)) < 26;
      if (nearCross && random() < dt * 0.9) {
        if (car.axis === 'v') {
          car.axis = 'h';
          car.y = roadCentre(car.y);
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.axis = 'v';
          car.x = roadCentre(car.x);
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // Wrap around the city edge so the streets stay busy.
      if (car.x < -60) car.x = CITY.width + 50;
      if (car.x > CITY.width + 60) car.x = -50;
      if (car.y < -60) car.y = CITY.height + 50;
      if (car.y > CITY.height + 60) car.y = -50;
      // A traffic car that wanders off-road (after a turn) is nudged back.
      if (!isRoad(car.x, car.y)) {
        if (car.axis === 'v') car.x = roadCentre(car.x);
        else car.y = roadCentre(car.y);
      }
    }
  }

  function stepPeds(dt, player, danger) {
    for (const ped of peds) {
      if (ped.down > 0) { ped.down -= dt; continue; }
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (danger && d2 < 130 * 130) {
        // Flee from the player.
        ped.fleeing = true;
        const d = Math.sqrt(d2) || 1;
        ped.tx = ped.x + (dx / d) * 220;
        ped.ty = ped.y + (dy / d) * 220;
      } else if (ped.fleeing && d2 > 260 * 260) {
        ped.fleeing = false;
      }
      const tx = ped.tx - ped.x;
      const ty = ped.ty - ped.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 8) { pickPedTarget(ped); continue; }
      const sp = ped.speed * (ped.fleeing ? 2.4 : 1);
      const nx = ped.x + (tx / dist) * sp * dt;
      const ny = ped.y + (ty / dist) * sp * dt;
      // Pedestrians stay out of buildings and off the road centre.
      if (!city.blocked(nx, ped.y, 8)) ped.x = nx;
      if (!city.blocked(ped.x, ny, 8)) ped.y = ny;
      ped.walkPhase += dt * (ped.fleeing ? 14 : 8);
    }
  }

  return { cars, peds, stepCars, stepPeds, CAR_W, CAR_H };
}
