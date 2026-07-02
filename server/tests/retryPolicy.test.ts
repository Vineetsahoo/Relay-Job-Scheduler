import { computeRetryDelaySeconds, hasExhaustedRetries, RetryPolicyConfig } from '../src/jobs/retryPolicy';

describe('computeRetryDelaySeconds', () => {
  const base: RetryPolicyConfig = {
    strategy: 'fixed',
    baseDelaySeconds: 10,
    maxDelaySeconds: 1000,
    maxAttempts: 5,
  };

  it('fixed strategy always returns the base delay', () => {
    expect(computeRetryDelaySeconds({ ...base, strategy: 'fixed' }, 1)).toBe(10);
    expect(computeRetryDelaySeconds({ ...base, strategy: 'fixed' }, 4)).toBe(10);
  });

  it('linear strategy scales delay by attempt number', () => {
    const policy: RetryPolicyConfig = { ...base, strategy: 'linear' };
    expect(computeRetryDelaySeconds(policy, 1)).toBe(10);
    expect(computeRetryDelaySeconds(policy, 2)).toBe(20);
    expect(computeRetryDelaySeconds(policy, 3)).toBe(30);
  });

  it('exponential strategy doubles delay each attempt', () => {
    const policy: RetryPolicyConfig = { ...base, strategy: 'exponential' };
    expect(computeRetryDelaySeconds(policy, 1)).toBe(10);
    expect(computeRetryDelaySeconds(policy, 2)).toBe(20);
    expect(computeRetryDelaySeconds(policy, 3)).toBe(40);
    expect(computeRetryDelaySeconds(policy, 4)).toBe(80);
  });

  it('clamps delay to maxDelaySeconds', () => {
    const policy: RetryPolicyConfig = { ...base, strategy: 'exponential', maxDelaySeconds: 50 };
    expect(computeRetryDelaySeconds(policy, 10)).toBe(50);
  });

  it('throws on invalid attempt numbers', () => {
    expect(() => computeRetryDelaySeconds(base, 0)).toThrow();
    expect(() => computeRetryDelaySeconds(base, -1)).toThrow();
  });
});

describe('hasExhaustedRetries', () => {
  const policy: RetryPolicyConfig = {
    strategy: 'fixed',
    baseDelaySeconds: 10,
    maxDelaySeconds: 100,
    maxAttempts: 3,
  };

  it('is false while attempts remain', () => {
    expect(hasExhaustedRetries(policy, 1)).toBe(false);
    expect(hasExhaustedRetries(policy, 2)).toBe(false);
  });

  it('is true once attemptCount reaches maxAttempts', () => {
    expect(hasExhaustedRetries(policy, 3)).toBe(true);
    expect(hasExhaustedRetries(policy, 4)).toBe(true);
  });
});
