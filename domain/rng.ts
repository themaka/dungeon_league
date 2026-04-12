export interface Rng {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
  rollStat(): number;
  fork(label: string): Rng;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const raw = mulberry32(seed);

  const rng: Rng = {
    next: raw,

    nextInt(min: number, max: number): number {
      return min + Math.floor(raw() * (max - min + 1));
    },

    pick<T>(items: readonly T[]): T {
      return items[Math.floor(raw() * items.length)];
    },

    shuffle<T>(items: T[]): T[] {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    rollStat(): number {
      const rolls = Array.from({ length: 4 }, () => rng.nextInt(1, 6));
      rolls.sort((a, b) => a - b);
      return rolls[1] + rolls[2] + rolls[3];
    },

    fork(label: string): Rng {
      const childSeed = seed ^ hashString(label);
      return createRng(childSeed);
    },
  };

  return rng;
}

export function seedFromIds(...ids: string[]): number {
  return hashString(ids.join(":"));
}
