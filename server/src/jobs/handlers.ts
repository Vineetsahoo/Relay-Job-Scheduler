/**
 * Job handler registry.
 *
 * A real deployment would map `job.type` to real business logic (send an
 * email, process a video, call a webhook, etc). For this project, a small
 * set of demo handlers is provided so the whole lifecycle can be exercised
 * end-to-end without external dependencies. Add new handlers here and they
 * become immediately available as a `type` when creating jobs via the API.
 */

export interface JobContext {
  jobId: string;
  payload: Record<string, any>;
  log: (message: string, level?: 'info' | 'warn' | 'error') => Promise<void>;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, any> | void>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const handlers: Record<string, JobHandler> = {
  // Waits `payload.ms` (default 1000) then completes. Good for testing delays/concurrency.
  sleep: async (ctx) => {
    const ms = ctx.payload.ms ?? 1000;
    await ctx.log(`Sleeping for ${ms}ms`);
    await sleep(ms);
    return { slept_ms: ms };
  },

  // Writes payload.message to the job log. Trivial smoke-test handler.
  log_message: async (ctx) => {
    await ctx.log(String(ctx.payload.message ?? '(no message provided)'));
    return { logged: true };
  },

  // Performs a real outbound HTTP request — demonstrates a realistic job type.
  http_request: async (ctx) => {
    const url = ctx.payload.url;
    if (!url) throw new Error('payload.url is required for http_request jobs');
    await ctx.log(`Requesting ${url}`);
    const res = await fetch(url, { method: ctx.payload.method ?? 'GET' });
    await ctx.log(`Response status: ${res.status}`);
    if (!res.ok) throw new Error(`HTTP request failed with status ${res.status}`);
    return { status: res.status };
  },

  // Fails a configurable fraction of the time — used to demonstrate
  // retries / DLQ behavior in demos and tests.
  fail_randomly: async (ctx) => {
    const failRate = ctx.payload.fail_rate ?? 0.7;
    await ctx.log(`Rolling dice with fail_rate=${failRate}`);
    if (Math.random() < failRate) {
      throw new Error('Simulated random failure');
    }
    return { succeeded: true };
  },
};

export function getHandler(type: string): JobHandler | undefined {
  return handlers[type];
}
