// The city of Teluk Senja: a grid of blocks separated by roads, generated
// once from the seeded RNG. Buildings are solid rectangles; parks are open
// green blocks with trees; the harbour is a water strip along the south
// edge. Roads are implicit in the grid, so any module can ask whether a
// point is on a road or inside a building without a lookup table.
import { CITY, PALETTE } from './config.js';
import { randInt, randPick, randRange } from './random.js';

export function isRoad(x, y) {
  const px = ((x % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const py = ((y % CITY.pitch) + CITY.pitch) % CITY.pitch;
  return px < CITY.road || py < CITY.road;
}

/** Centre of the nearest road, for a point on a road of the given axis. */
export function roadCentre(coord) {
  const base = Math.floor(coord / CITY.pitch) * CITY.pitch;
  return base + CITY.road / 2;
}

/** True when the point is on a road running along the given axis. */
export function onAxisRoad(x, y, axis) {
  const c = axis === 'h' ? y : x;
  const p = ((c % CITY.pitch) + CITY.pitch) % CITY.pitch;
  return p < CITY.road;
}

/** Centre of block (col, row), in world coordinates. */
export function blockCentre(col, row) {
  return {
    x: col * CITY.pitch + CITY.road + (CITY.pitch - CITY.road) / 2,
    y: row * CITY.pitch + CITY.road + (CITY.pitch - CITY.road) / 2,
  };
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];

  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const bx = col * CITY.pitch + CITY.road;
      const by = row * CITY.pitch + CITY.road;
      const bw = CITY.pitch - CITY.road;
      const bh = CITY.pitch - CITY.road;
      // The harbour block and the central square are parks, not buildings.
      const isPark = (col === 8 && row === 6) || (col === 4 && row === 3) || random() < 0.12;
      if (isPark) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        const n = randInt(random, 5, 9);
        for (let i = 0; i < n; i += 1) {
          trees.push({
            x: bx + randRange(random, 18, bw - 18),
            y: by + randRange(random, 18, bh - 18),
            r: randRange(random, 9, 15),
          });
        }
        continue;
      }
      // One or two buildings per block, leaving a sidewalk margin.
      const split = random() < 0.45;
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p += 1) {
        const w = split ? bw / 2 - 14 : bw - 28;
        const h = split ? bh - 28 : bh - 28;
        const x = bx + 14 + (split ? p * (bw / 2) : 0);
        const y = by + 14;
        const color = randPick(random, PALETTE.buildingRoof);
        const windows = [];
        const cols = Math.max(2, Math.floor(w / 34));
        const rowsW = Math.max(2, Math.floor(h / 34));
        for (let wy = 0; wy < rowsW; wy += 1) {
          for (let wx = 0; wx < cols; wx += 1) {
            windows.push({
              x: x + 10 + wx * ((w - 20) / cols),
              y: y + 10 + wy * ((h - 20) / rowsW),
              lit: random() < 0.45,
            });
          }
        }
        buildings.push({ x, y, w, h, color, windows });
      }
      // Some blocks get a small car park with a couple of parked cars.
      if (random() < 0.3) lots.push({ x: bx + 10, y: by + bh - 34, w: bw - 20, h: 24 });
    }
  }

  // Named landmarks the missions use. Most sit on the road intersection
  // beside their block, so the player can always reach them; the two in
  // parks use the park centre, which is open ground.
  function roadPoint(col, row) {
    return { x: col * CITY.pitch + CITY.road / 2, y: row * CITY.pitch + CITY.road / 2 };
  }
  const landmarks = {
    cafe: roadPoint(2, 1), // Warung Kopi Mira — where the story starts
    drop: roadPoint(7, 5), // the drop-off flats
    safehouse: roadPoint(1, 5), // Raka's garage
    warehouse: roadPoint(8, 2), // the old fish warehouse
    miraHome: blockCentre(4, 3), // the central square, Mira waits here
    harbour: blockCentre(8, 6), // the harbour park
  };

  // Cash, health and ammo pickups on the roads, where a player on foot or
  // in a car can actually reach them.
  const pickups = [];
  const kinds = ['cash', 'cash', 'cash', 'health', 'ammo', 'cash', 'health', 'ammo'];
  for (let i = 0; i < 16; i += 1) {
    const onVertical = random() < 0.5;
    const line = randInt(random, 0, onVertical ? CITY.cols : CITY.rows);
    const along = randRange(random, 140, (onVertical ? CITY.height : CITY.width) - 140);
    pickups.push({
      kind: kinds[i % kinds.length],
      x: onVertical ? line * CITY.pitch + CITY.road / 2 + randRange(random, -24, 24) : along,
      y: onVertical ? along : line * CITY.pitch + CITY.road / 2 + randRange(random, -24, 24),
      taken: false,
      bob: random() * Math.PI * 2,
    });
  }

  function blocked(x, y, r) {
    if (x < r || y < r || x > CITY.width - r || y > CITY.height - r) return true;
    for (let i = 0; i < buildings.length; i += 1) {
      if (circleHitsRect(x, y, r, buildings[i])) return true;
    }
    return false;
  }

  /** Push a circle out of buildings and the world edge; returns true if moved. */
  function resolveCircle(pos, r) {
    let moved = false;
    if (pos.x < r) { pos.x = r; moved = true; }
    if (pos.y < r) { pos.y = r; moved = true; }
    if (pos.x > CITY.width - r) { pos.x = CITY.width - r; moved = true; }
    if (pos.y > CITY.height - r) { pos.y = CITY.height - r; moved = true; }
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (!circleHitsRect(pos.x, pos.y, r, b)) continue;
      const left = pos.x - (b.x - r);
      const right = b.x + b.w + r - pos.x;
      const top = pos.y - (b.y - r);
      const bottom = b.y + b.h + r - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
      moved = true;
    }
    return moved;
  }

  return { buildings, parks, trees, lots, landmarks, pickups, blocked, resolveCircle };
}
