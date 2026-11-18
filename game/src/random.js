// A small seeded random number generator (mulberry32): the same seed gives
// the same city, traffic and missions, which is what makes the game and its
// screenshot scenes repeatable. The simulation never uses Math.random.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max). */
export function randInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** Pick one element of an array. */
export function randPick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A value in [min, max). */
export function randRange(random, min, max) {
  return min + random() * (max - min);
}
