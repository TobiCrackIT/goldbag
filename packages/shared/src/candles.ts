import { z } from "zod";
import { CandleInterval } from "./chain.js";

export const Candle = z.object({
  ts: z.iso.datetime(),
  o: z.string(),
  h: z.string(),
  l: z.string(),
  c: z.string(),
  volume: z.string().nullable(),
});
export type Candle = z.infer<typeof Candle>;

export const CandlesQuery = z.object({
  interval: CandleInterval,
  limit: z.coerce.number().int().min(1).max(1000).default(300),
});
export type CandlesQuery = z.infer<typeof CandlesQuery>;
