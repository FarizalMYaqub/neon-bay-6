// Seeded RNG (mulberry32) so screenshot modes are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a rng function.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one item from an array with a rng function.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Parse the URL query used by the screenshot modes: ?shot=<name>&seed=7
export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: Number(q.get('seed') || 7) };
}
