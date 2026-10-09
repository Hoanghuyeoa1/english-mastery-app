// src/services/api/httpClient.ts

export type CanonicalErrorCategory =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'VALIDATION'
  | 'AUTH'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'DATABASE_ERROR';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: string;
  traceId?: string;
}

export class ApiError extends Error {
  public code: string;
  public details?: string;
  public status: number;
  public traceId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || 'Lỗi kết nối máy chủ');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.details = payload.details;
    this.traceId = payload.traceId;
  }

  public get category(): CanonicalErrorCategory {
    if (this.status === 408 || this.code === 'TIMEOUT') return 'TIMEOUT';
    if (this.status === 0 || this.code === 'NETWORK' || this.code === 'NETWORK_ERROR') return 'NETWORK';
    if (this.status === 401 || this.code === 'AUTH' || this.code === 'UNAUTHORIZED') return 'AUTH';
    if (this.status === 403 || this.code === 'FORBIDDEN') return 'FORBIDDEN';
    if (this.status === 409 || this.code === 'CONFLICT') return 'CONFLICT';
    if (this.status === 429 || this.code === 'RATE_LIMIT') return 'RATE_LIMIT';
    if (
      this.status === 400 ||
      this.code === 'VALIDATION' ||
      this.code === 'VALIDATION_FAILED' ||
      this.code === 'BAD_REQUEST'
    ) return 'VALIDATION';
    if (this.status === 502 || this.status === 503 || this.status === 504 || this.code === 'DATABASE_ERROR') {
      return 'DATABASE_ERROR';
    }
    return 'SERVER_ERROR';
  }
}

const ACCESS_TOKEN_KEY = 'emh_access_token';

let inMemoryAccessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  if (import.meta.env?.PROD) {
    return '/api';
  }
  return 'http://localhost:5000/api';
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    }
  } catch {}
  return null;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }
  } catch {}
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
  skipAutoRefresh?: boolean;
}

export async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (baseUrl.endsWith('/api')) {
    if (cleanEndpoint === '/api') {
      cleanEndpoint = '';
    } else if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    }
  }
  const url = `${baseUrl}${cleanEndpoint}`;

  const {
    timeoutMs = 15000,
    skipAuth = false,
    skipAutoRefresh = false,
    headers: customHeaders = {},
    signal: callerSignal,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true });
    }
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !skipAuth && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Enables secure HttpOnly refresh token cookie
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Xử lý 401 Unauthorized tự động với Refresh Token Queue
    if (response.status === 401 && !skipAutoRefresh && refreshHandler && !endpoint.includes('/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshHandler();
          isRefreshing = false;
          refreshQueue.forEach((callback) => callback(newToken));
          refreshQueue = [];

          if (newToken) {
            // Thử lại request hiện tại với token mới
            return fetchApi<T>(endpoint, { ...options, skipAutoRefresh: true });
          }
        } catch (refreshErr) {
          isRefreshing = false;
          refreshQueue.forEach((callback) => callback(null));
          refreshQueue = [];
          setAccessToken(null);
          unauthorizedHandler?.();
          throw refreshErr;
        }
      } else {
        // Chờ token mới được refresh
        return new Promise<T>((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              fetchApi<T>(endpoint, { ...options, skipAutoRefresh: true })
                .then(resolve)
                .catch(reject);
            } else {
              reject(new ApiError(401, { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã hết hạn.' }));
            }
          });
        });
      }
    }

    // Xử lý các mã lỗi khác hoặc 401 không thể refresh
    if (!response.ok) {
      let errorPayload: ApiErrorPayload;
      try {
        const json = await response.json();

        let extractedMessage: string | undefined = json.message || json.Message;
        let extractedDetails: string | undefined = json.details || json.Details;
        let extractedCode: string | undefined = json.code || json.Code;
        const traceId: string | undefined = json.traceId || json.requestId || json.TraceId || json.RequestId;

        // Trích xuất validation messages từ ASP.NET Core ValidationProblemDetails (RFC 7807)
        if (json.errors && typeof json.errors === 'object') {
          const fieldErrors = Object.entries(json.errors as Record<string, unknown>)
            .map(([field, msgs]) => (Array.isArray(msgs) ? `${field}: ${msgs.join(', ')}` : `${field}: ${msgs}`))
            .join('; ');
          extractedDetails = extractedDetails ? `${extractedDetails}; ${fieldErrors}` : fieldErrors;
          if (!extractedMessage) {
            const allMsgs = Object.values(json.errors as Record<string, unknown>).flat() as string[];
            extractedMessage = allMsgs.join('. ') || json.title;
          }
        }

        if (!extractedMessage && json.title) {
          extractedMessage = json.title;
        }

        if (!extractedCode) {
          switch (response.status) {
            case 400:
              extractedCode = 'VALIDATION_FAILED';
              break;
            case 401:
              extractedCode = 'UNAUTHORIZED';
              break;
            case 403:
              extractedCode = 'FORBIDDEN';
              break;
            case 404:
              extractedCode = 'NOT_FOUND';
              break;
            case 409:
              extractedCode = 'CONFLICT';
              break;
            case 429:
              extractedCode = 'RATE_LIMIT';
              break;
            case 500:
              extractedCode = 'SERVER_ERROR';
              break;
            case 502:
            case 503:
            case 504:
              extractedCode = 'DATABASE_ERROR';
              break;
            default:
              extractedCode = 'HTTP_ERROR';
          }
        }

        errorPayload = {
          code: extractedCode,
          message: extractedMessage || `Lỗi máy chủ (${response.status})`,
          details: extractedDetails,
          traceId,
        };
      } catch {
        let fallbackCode: string;
        switch (response.status) {
          case 400: fallbackCode = 'VALIDATION_FAILED'; break;
          case 401: fallbackCode = 'UNAUTHORIZED'; break;
          case 403: fallbackCode = 'FORBIDDEN'; break;
          case 404: fallbackCode = 'NOT_FOUND'; break;
          case 409: fallbackCode = 'CONFLICT'; break;
          case 429: fallbackCode = 'RATE_LIMIT'; break;
          case 502:
          case 503:
          case 504: fallbackCode = 'DATABASE_ERROR'; break;
          default: fallbackCode = response.status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR';
        }
        errorPayload = {
          code: fallbackCode,
          message: response.statusText || `Lỗi phản hồi HTTP ${response.status}`,
        };
      }

      if (response.status === 401) {
        setAccessToken(null);
        unauthorizedHandler?.();
      }

      throw new ApiError(response.status, errorPayload);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if ((err as any)?.name === 'AbortError') {
      if (callerSignal?.aborted) {
        throw new ApiError(499, {
          code: 'CLIENT_CLOSED_REQUEST',
          message: 'Yêu cầu đã được hủy bởi người dùng.',
        });
      }
      throw new ApiError(408, {
        code: 'TIMEOUT',
        message: 'Yêu cầu máy chủ quá thời gian phản hồi (Timeout).',
      });
    }

    const message = err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ backend.';
    const isDev = Boolean(import.meta.env?.DEV);
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: message.includes('Failed to fetch')
        ? (isDev
            ? 'Không thể kết nối tới máy chủ API (http://localhost:5000). Đảm bảo Backend ASP.NET Core đang chạy.'
            : 'Không thể kết nối tới máy chủ API. Vui lòng kiểm tra kết nối mạng.')
        : message,
    });
  }
}
