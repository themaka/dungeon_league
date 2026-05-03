export type BuffKind = "bless" | "inspiration" | "aura" | "guidance";

export interface ActiveBuff {
  kind: BuffKind;
  sourceId: string;
  targetId: string;
  charges: number;
  bonus: number;
}

export interface BuffState {
  byTarget: Map<string, ActiveBuff[]>;
}

export function newBuffState(): BuffState {
  return { byTarget: new Map() };
}

export function addBuff(state: BuffState, buff: ActiveBuff): void {
  const list = state.byTarget.get(buff.targetId) ?? [];
  list.push(buff);
  state.byTarget.set(buff.targetId, list);
}

export function consumeBuff(state: BuffState, targetId: string, kind: BuffKind): ActiveBuff | undefined {
  const list = state.byTarget.get(targetId);
  if (!list) return undefined;
  const idx = list.findIndex((b) => b.kind === kind && b.charges > 0);
  if (idx < 0) return undefined;
  const buff = list[idx];
  const updated = { ...buff, charges: buff.charges - 1 };
  if (updated.charges <= 0) {
    list.splice(idx, 1);
  } else {
    list[idx] = updated;
  }
  return buff;
}

export function buffersOf(state: BuffState, targetId: string): string[] {
  return (state.byTarget.get(targetId) ?? []).map((b) => b.sourceId);
}

export function clearTargetBuffs(state: BuffState, targetId: string): void {
  state.byTarget.delete(targetId);
}
