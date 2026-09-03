export interface EnqueueBackoffOptions {
  type: 'fixed' | 'exponential';
  delayMs: number;
}

export interface EnqueueOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: EnqueueBackoffOptions;
}

export interface EnqueueResult {
  id: string;
}
