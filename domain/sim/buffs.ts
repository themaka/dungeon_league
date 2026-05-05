export interface BuffPools {
  bless: Map<string, number>;         // sourceId -> remaining charges
  inspiration: Map<string, number>;
  revivify: Map<string, number>;
}

export function newBuffPools(): BuffPools {
  return {
    bless: new Map(),
    inspiration: new Map(),
    revivify: new Map(),
  };
}
