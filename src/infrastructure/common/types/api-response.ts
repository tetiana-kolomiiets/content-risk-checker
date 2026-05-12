export interface ApiResponseMeta {
  traceId: string;
  apiVersion: 'v1';
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  error: null;
  meta: ApiResponseMeta;
}

export interface ApiErrorResponse {
  data: null;
  error: { code: string; message: string; details?: unknown };
  meta: ApiResponseMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const isApiEnvelope = (
  value: unknown,
): value is ApiResponse<unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return 'data' in candidate && 'error' in candidate;
};
