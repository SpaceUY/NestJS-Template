export const SPACESHIP_NOTIFICATION_QUEUE = 'spaceship-notifications';
export const SPACESHIP_CREATED_JOB = 'spaceship-created';

// Single source of truth for the producer's `options.attempts` and the
// processor's retries-exhausted check — they must agree, since MessageContext
// (broker-agnostic by design) can't expose the configured max back to the
// consumer.
export const SPACESHIP_NOTIFICATION_MAX_ATTEMPTS = 3;
