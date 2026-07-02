export interface Organization {
  id: string;
  name: string;
  role: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  api_key: string;
  created_at: string;
}

export interface Queue {
  id: string;
  project_id: string;
  name: string;
  priority: number;
  concurrency_limit: number;
  is_paused: boolean;
  strategy?: string;
  base_delay_seconds?: number;
  max_delay_seconds?: number;
  max_attempts?: number;
  queued_count?: number;
  running_count?: number;
  completed_count?: number;
  dead_letter_count?: number;
  created_at: string;
}

export type JobStatus =
  | 'scheduled' | 'queued' | 'claimed' | 'running'
  | 'completed' | 'failed' | 'retrying' | 'dead_letter' | 'cancelled';

export interface Job {
  id: string;
  queue_id: string;
  type: string;
  payload: Record<string, any>;
  priority: number;
  status: JobStatus;
  run_at: string;
  attempt_count: number;
  max_attempts: number;
  claimed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: any;
  error: string | null;
  batch_id: string | null;
  created_at: string;
  executions?: JobExecution[];
  logs?: JobLog[];
}

export interface JobExecution {
  id: string;
  job_id: string;
  worker_id: string | null;
  attempt_number: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  result: any;
}

export interface JobLog {
  id: number;
  job_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  hostname: string;
  status: 'online' | 'offline' | 'draining';
  concurrency: number;
  active_job_count: number;
  started_at: string;
  last_heartbeat_at: string;
  is_stale: boolean;
}

export interface ScheduledJob {
  id: string;
  queue_id: string;
  name: string;
  cron_expression: string;
  job_type: string;
  payload: Record<string, any>;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
}

export interface DeadLetterEntry {
  id: string;
  original_job_id: string;
  queue_id: string;
  type: string;
  payload: Record<string, any>;
  attempt_count: number;
  last_error: string;
  moved_at: string;
  current_job_status?: string;
}
