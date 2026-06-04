export function randomIndex(length: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

export function weightedPick<T extends { weight: number }>(items: T[], usedTexts: Map<string, number>): T {
  const weighted = items.map((item) => {
    const used = usedTexts.get('text' in item ? String(item.text) : '') ?? 0;
    return { item, weight: Math.max(1, Math.floor(item.weight / (used + 1))) };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = randomIndex(total);
  for (const entry of weighted) {
    if (cursor < entry.weight) {
      return entry.item;
    }
    cursor -= entry.weight;
  }
  return weighted[weighted.length - 1].item;
}
