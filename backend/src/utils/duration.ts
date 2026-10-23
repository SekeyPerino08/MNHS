const durationUnits: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  y: 31_557_600_000,
};

export function durationToMilliseconds(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|y)$/i.exec(duration);
  if (!match) {
    throw new Error("Invalid duration.");
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * durationUnits[unit];
}
