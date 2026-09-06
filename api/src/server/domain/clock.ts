let businessClock: () => Date = () => new Date();

export function now(): Date {
  return businessClock();
}

export function setBusinessClock(clock: () => Date): void {
  businessClock = clock;
}
