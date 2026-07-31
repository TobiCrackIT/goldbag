import type { CandleInterval as PrismaCandleInterval } from "@prisma/client";
import type { CandleInterval } from "@goldbag/shared";

/** Wire format ("1m") ↔ Prisma enum name ("m1") mapping + bucket sizes. */
export const INTERVALS: { wire: CandleInterval; prisma: PrismaCandleInterval; ms: number }[] = [
  { wire: "1m", prisma: "m1", ms: 60_000 },
  { wire: "15m", prisma: "m15", ms: 900_000 },
  { wire: "1h", prisma: "h1", ms: 3_600_000 },
  { wire: "1d", prisma: "d1", ms: 86_400_000 },
];

export const toPrismaInterval = (wire: CandleInterval): PrismaCandleInterval =>
  INTERVALS.find((i) => i.wire === wire)!.prisma;

export const bucketStart = (ms: number, now = Date.now()) => new Date(Math.floor(now / ms) * ms);
