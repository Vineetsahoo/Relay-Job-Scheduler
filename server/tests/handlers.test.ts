import { getHandler } from '../src/jobs/handlers';

function makeContext(payload: Record<string, any> = {}) {
  const logs: string[] = [];
  return {
    ctx: {
      jobId: 'test-job-id',
      payload,
      log: async (message: string) => {
        logs.push(message);
      },
    },
    logs,
  };
}

describe('job handlers registry', () => {
  it('returns undefined for an unknown job type', () => {
    expect(getHandler('does_not_exist')).toBeUndefined();
  });

  it('log_message handler logs the provided message and returns success', async () => {
    const handler = getHandler('log_message')!;
    const { ctx, logs } = makeContext({ message: 'hello world' });
    const result = await handler(ctx);
    expect(logs).toContain('hello world');
    expect(result).toEqual({ logged: true });
  });

  it('sleep handler resolves after roughly the requested duration', async () => {
    const handler = getHandler('sleep')!;
    const { ctx } = makeContext({ ms: 20 });
    const start = Date.now();
    const result = await handler(ctx);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    expect(result).toEqual({ slept_ms: 20 });
  });

  it('fail_randomly always throws when fail_rate is 1', async () => {
    const handler = getHandler('fail_randomly')!;
    const { ctx } = makeContext({ fail_rate: 1 });
    await expect(handler(ctx)).rejects.toThrow('Simulated random failure');
  });

  it('fail_randomly never throws when fail_rate is 0', async () => {
    const handler = getHandler('fail_randomly')!;
    const { ctx } = makeContext({ fail_rate: 0 });
    await expect(handler(ctx)).resolves.toEqual({ succeeded: true });
  });
});
