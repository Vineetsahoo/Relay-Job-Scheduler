import { RetryStrategy } from '../types';

export interface RetryPolicyConfig {
  strategy: RetryStrategy;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  maxAttempts: number;
}

/**
 * Computes how many seconds to wait before the next retry attempt.
 *
 * attemptNumber is 1-indexed: the delay returned is "how long to wait after
 * attempt N fails, before attempt N+1 is eligible to run".
 *
 *  - fixed:       always baseDelaySeconds
 *  - linear:      baseDelaySeconds * attemptNumber
 *  - exponential: baseDelaySeconds * 2^(attemptNumber - 1)
 *
 * Result is always clamped to maxDelaySeconds.
 */
export function computeRetryDelaySeconds(
  policy: RetryPolicyConfig,
  attemptNumber: number
): number {
  if (attemptNumber < 1) {
    throw new Error('attemptNumber must be >= 1');
  }

  let delay: number;

  switch (policy.strategy) {
    case 'fixed':
      delay = policy.baseDelaySeconds;
      break;
    case 'linear':
      delay = policy.baseDelaySeconds * attemptNumber;
      break;
    case 'exponential':
      delay = policy.baseDelaySeconds * Math.pow(2, attemptNumber - 1);
      break;
    default:
      throw new Error(`Unknown retry strategy: ${policy.strategy}`);
  }

  return Math.min(delay, policy.maxDelaySeconds);
}

/** True once attemptCount has exhausted the policy's max attempts. */
export function hasExhaustedRetries(policy: RetryPolicyConfig, attemptCount: number): boolean {
  return attemptCount >= policy.maxAttempts;
}
