import type { HealthCheckResponse } from '@lotmorewins/types';

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  getAuthToken?: () => string | null | Promise<string | null>;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly getAuthToken?: () => string | null | Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.defaultHeaders,
    };
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.getAuthToken = config.getAuthToken;
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, timeoutMs, headers = {}, ...customConfig } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    let urlString = `${this.baseUrl}${cleanEndpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        urlString += (urlString.includes('?') ? '&' : '?') + queryString;
      }
    }

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers as Record<string, string>),
    };

    if (this.getAuthToken && !mergedHeaders.Authorization) {
      const token = await this.getAuthToken();
      if (token) {
        mergedHeaders.Authorization = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(urlString, {
        ...customConfig,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        let errorDetails: unknown;

        if (isJson && typeof data === 'object' && data !== null) {
          const jsonObj = data as Record<string, unknown>;
          if (typeof jsonObj.message === 'string') {
            errorMessage = jsonObj.message;
          }
          if (typeof jsonObj.code === 'string') {
            errorCode = jsonObj.code;
          }
          errorDetails = jsonObj.details;
        }

        throw new ApiClientError(response.status, errorMessage, errorCode, errorDetails);
      }

      return data as T;
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError(408, `Request timed out after ${effectiveTimeout}ms`, 'TIMEOUT');
      }
      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new ApiClientError(0, message, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Health check convenience method
   */
  public checkHealth(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
