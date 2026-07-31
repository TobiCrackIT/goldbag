/** Redis key/channel names — one place, no stringly-typed drift. */
export const PRICES_CHANNEL = "prices";
export const priceKey = (assetId: string) => `price:${assetId}`;
export const PRICE_TTL_SECONDS = 60;

/** Per-user event channel (deposit confirmed, order status, …). */
export const userEventsChannel = (userId: string) => `user:${userId}:events`;
export const USER_EVENTS_PATTERN = "user:*:events";
