export type ApiError = {
  code?: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T = unknown> = {
  success: boolean;
  data: T | null;
  message?: string | null;
  error?: ApiError | null;
};
