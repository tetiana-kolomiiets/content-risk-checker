import type { ApiEnvelope, Check, HealthStatus, SourceType, StepLog } from './types';
import { ApiError } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const RATE_LIMIT_COUNTDOWN_SECONDS = 12;

type ApiErrorNotifier = (error: ApiError | Error) => void;

let apiErrorNotifier: ApiErrorNotifier | null = null;

export function setApiErrorNotifier(notifier: ApiErrorNotifier | null) {
  apiErrorNotifier = notifier;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    const networkError = new Error('Network error');
    apiErrorNotifier?.(networkError);
    throw networkError;
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    const responseError = new ApiError('INVALID_RESPONSE', `Non-JSON response (${res.status})`, res.status, '');
    apiErrorNotifier?.(responseError);
    throw responseError;
  }

  if (!res.ok || body.error) {
    const apiError = new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body.meta?.traceId ?? '',
    );
    apiErrorNotifier?.(apiError);
    throw apiError;
  }

  if (body.data === null) {
    const emptyResponseError = new ApiError('EMPTY_RESPONSE', 'API returned no data', res.status, body.meta?.traceId ?? '');
    apiErrorNotifier?.(emptyResponseError);
    throw emptyResponseError;
  }

  return body.data;
}

export function getRateLimitCountdownSteps(): number[] {
  return Array.from({ length: RATE_LIMIT_COUNTDOWN_SECONDS - 1 }, (_, index) => RATE_LIMIT_COUNTDOWN_SECONDS - 1 - index);
}

export const api = {
  health(): Promise<HealthStatus> {
    return request<HealthStatus>('/health');
  },

  listChecks(filters?: { status?: string; include?: string[] }): Promise<{ items: Check[] }> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set('status', filters.status);
    }
    if (filters?.include?.length) {
      params.set('include', filters.include.join(','));
    }
    const qs = params.toString();
    return request<{ items: Check[] }>(`/content-risk-checks${qs ? `?${qs}` : ''}`);
  },

  getCheck(id: string): Promise<Check> {
    return request<Check>(`/content-risk-checks/${id}?include=rawText`);
  },

  getLogs(id: string): Promise<StepLog[]> {
    return request<StepLog[]>(`/content-risk-checks/${id}/logs`);
  },

  createCheck(input: { text: string; sourceType?: SourceType }): Promise<Check> {
    return request<Check>('/content-risk-checks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  replayCheck(id: string): Promise<Check> {
    return request<Check>(`/content-risk-checks/${id}/replay`, { method: 'POST' });
  },

  activatePrompt(id: string): Promise<{ activated: string }> {
    return request<{ activated: string }>(`/prompts/${id}/activate`, { method: 'POST' });
  },
};
