import type { ApiEnvelope, Check, HealthStatus, SourceType, StepLog } from './types';
import { ApiError } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('INVALID_RESPONSE', `Non-JSON response (${res.status})`, res.status, '');
  }

  if (!res.ok || body.error) {
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `HTTP ${res.status}`,
      res.status,
      body.meta?.traceId ?? '',
    );
  }

  if (body.data === null) {
    throw new ApiError('EMPTY_RESPONSE', 'API returned no data', res.status, body.meta?.traceId ?? '');
  }

  return body.data;
}

export const api = {
  health(): Promise<HealthStatus> {
    return request<HealthStatus>('/health');
  },

  listChecks(filters?: { status?: string }): Promise<{ items: Check[] }> {
    const qs = filters?.status ? `?status=${filters.status}` : '';
    return request<{ items: Check[] }>(`/content-risk-checks${qs}`);
  },

  getCheck(id: string): Promise<Check> {
    return request<Check>(`/content-risk-checks/${id}`);
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
