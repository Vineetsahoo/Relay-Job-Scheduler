export type JobStatus =
  | 'scheduled'
  | 'queued'
  | 'claimed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'dead_letter'
  | 'cancelled';

export type RetryStrategy = 'fixed' | 'linear' | 'exponential';

export interface AuthedUser {
  id: string;
  email: string;
}

// Extends Express's Request with the authenticated user, set by auth middleware.
declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}
