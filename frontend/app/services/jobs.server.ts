import { api } from "~/services/api.server";

interface QueuedJob {
  task_id: string;
}

interface JobStatus<T> {
  state: string;
  ready: boolean;
  result?: T;
  error?: string;
}

const POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1_000;

export function queuedTaskId(response: unknown): string {
  const taskId = (response as QueuedJob | null)?.task_id;
  if (!taskId) throw new Error("La API no devolvió el identificador del trabajo");
  return taskId;
}

export async function waitForJob<T>(
  taskId: string,
  request: Request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = (await api.get(`/jobs/${taskId}`, request)) as JobStatus<T>;
    if (job.state === "SUCCESS") return job.result as T;
    if (job.state === "FAILURE" || job.state === "REVOKED") {
      throw new Error(job.error || "El trabajo en segundo plano no pudo completarse");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("El trabajo excedió el tiempo máximo de espera");
}
