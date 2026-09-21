/**
 * How long each dependency probe may take before the indicator reports it
 * down. Both sit well under the 5s timeout a typical ECS or ALB health check
 * allows, so the endpoint answers before the checker gives up on it — a probe
 * that outlives its caller reports nothing at all.
 */
export const DATABASE_PING_TIMEOUT_MS = 1500;
export const CACHE_PING_TIMEOUT_MS = 1000;

/**
 * The key the cache probe reads. It is never written, so the probe cannot
 * evict a real entry or grow the keyspace; a miss still proves the round trip.
 */
export const CACHE_PROBE_KEY = 'health:probe';
