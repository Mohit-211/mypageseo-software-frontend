/**
 * Shared HTTP client for every API call.
 *
 * Wraps `fetch` with the base URL, JSON encoding, the access token, a timeout,
 * silent token refresh on expiry or 401, and a typed `ApiError`. `ApiError`
 * carries `status`, which is what `classifyError` (lib/mypageseo/errors.ts) reads to pick the failure state.
 */
import { API_BASE_URL, API_TIMEOUT_MS } from "./config";
import { refreshToken } from "./auth/refresh-token";
import { clearAccessToken, getValidAccessToken, getValidRefreshToken } from "./token-storage";
import { getSelectedOrganizationId } from "./organization-storage";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  /** Set to false for endpoints that must not send the bearer token. */
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** `"blob"` returns the raw `Response` (for file downloads) instead of the parsed JSON body. */
  responseType?: "json" | "blob";
};

/** Field-level validation errors returned by the backend, keyed by field name. */
export type ApiFieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  /** Machine-readable cause from the error body's `data.reason` (e.g. `subscription_required`). Build UI states on this, not on `message`. */
  readonly reason: string | undefined;
  readonly fieldErrors: ApiFieldErrors | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    options: { code?: string; reason?: string; fieldErrors?: ApiFieldErrors; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code;
    this.reason = options.reason;
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Returns the error body's `data` object (where the backend puts `reason` and its
 * extra fields, e.g. `quote`, `limit`), or `{}` when there is none.
 */
export function apiErrorData(error: unknown): Record<string, unknown> {
  if (!isApiError(error)) return {};
  const details = error.details as { data?: unknown } | null | undefined;
  const data = details && typeof details === "object" ? details.data : undefined;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

/** Unwraps the backend's `{ success, status, message, data }` envelope; passes other payloads through. */
export function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload && "success" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const body = (payload && typeof payload === "object" ? payload : {}) as {
    message?: string;
    error?: string;
    code?: string;
    reason?: string;
    errors?: ApiFieldErrors;
    data?: { reason?: unknown } | string | null;
  };
  const dataReason =
    body.data && typeof body.data === "object" && typeof body.data.reason === "string" ? body.data.reason : undefined;
  const reason = dataReason ?? body.reason;
  const message =
    body.message ??
    body.error ??
    (typeof payload === "string" && payload ? payload : `Request failed (${status})`);
  return new ApiError(message, status, {
    ...(body.code ? { code: body.code } : {}),
    ...(reason ? { reason } : {}),
    ...(body.errors ? { fieldErrors: body.errors } : {}),
    details: payload,
  });
}

/**
 * Sends the request. For authenticated calls an expired access token is renewed
 * first, and a 401 triggers one refresh-and-retry before the session is dropped.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  if (auth && !getValidAccessToken() && getValidRefreshToken()) {
    // Best effort: if this fails the request goes out unauthenticated and the 401 path below handles it.
    await refreshToken().catch(() => undefined);
  }

  try {
    return await send<T>(path, options);
  } catch (error) {
    if (!(auth && error instanceof ApiError && error.status === 401)) throw error;
    if (!getValidRefreshToken()) {
      clearAccessToken();
      throw error;
    }
    try {
      await refreshToken();
    } catch {
      // refreshToken() already ends the session if the refresh token was rejected.
      throw error;
    }
    const retried = await send<T>(path, options).catch((retryError: unknown) => {
      if (retryError instanceof ApiError && retryError.status === 401) clearAccessToken();
      throw retryError;
    });
    return retried;
  }
}

async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    headers = {},
    auth = true,
    signal,
    timeoutMs = API_TIMEOUT_MS,
    responseType = "json",
  } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  const isFormData = body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    // FormData needs the browser to set its own multipart boundary, so no Content-Type for it.
    ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  if (auth) {
    const token = getValidAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
    // The organization picked in the header; without it the backend uses the default one.
    const organizationId = getSelectedOrganizationId();
    if (organizationId && !finalHeaders["X-Organization-Id"]) finalHeaders["X-Organization-Id"] = organizationId;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      credentials: "include",
      signal: controller.signal,
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (timedOut) throw new ApiError("Request timed out", 408);
    if (signal?.aborted) throw error;
    throw new ApiError("Network error: failed to fetch", 0, { details: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }

  if (responseType === "blob" && response.ok) return response as T;

  const payload = await parseBody(response);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

type MethodOptions = Omit<RequestOptions, "method" | "body">;

export const api = {
  get: <T>(path: string, options?: MethodOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
