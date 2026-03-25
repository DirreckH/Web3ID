import { appEnvConfig } from "../config/env";

export type ApiErrorCode = "NETWORK_ERROR" | "UNAUTHORIZED" | "SERVICE_UNAVAILABLE" | "TIMEOUT" | "HTTP_ERROR";

export class ApiClientError extends Error {
  code: ApiErrorCode;
  status?: number;
  cause?: unknown;

  constructor(message: string, code: ApiErrorCode, status?: number, cause?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

interface RequestOptions extends Omit<RequestInit, "signal"> {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

function isAbsoluteUrl(path: string) {
  return /^https?:\/\//i.test(path);
}

function resolveUrl(path: string) {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  if (!appEnvConfig.apiBaseUrl) {
    throw new ApiClientError(
      "Missing API base URL. Set `VITE_API_BASE_URL` when `VITE_DATA_SOURCE=api`.",
      "HTTP_ERROR",
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appEnvConfig.apiBaseUrl}${normalizedPath}`;
}

function mapHttpError(status: number, fallbackMessage: string) {
  if (status === 401 || status === 403) {
    return new ApiClientError("Authentication required. Please sign in again.", "UNAUTHORIZED", status);
  }

  if (status === 502 || status === 503 || status === 504) {
    return new ApiClientError("Service is temporarily unavailable. Please retry shortly.", "SERVICE_UNAVAILABLE", status);
  }

  return new ApiClientError(fallbackMessage, "HTTP_ERROR", status);
}

function parseBodySafely(text: string) {
  if (text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function debugLog(...messages: unknown[]) {
  if (appEnvConfig.appEnv === "development") {
    console.info("[apiClient]", ...messages);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const url = resolveUrl(path);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    const text = await response.text();
    const parsed = parseBodySafely(text);

    if (!response.ok) {
      const fallbackMessage = typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as { message: string }).message) : `Request failed with status ${response.status}.`;
      throw mapHttpError(response.status, fallbackMessage);
    }

    debugLog(options.method ?? "GET", url, response.status);
    return parsed as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Request timed out.", "TIMEOUT", undefined, error);
    }

    throw new ApiClientError("Network request failed.", "NETWORK_ERROR", undefined, error);
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export const apiClient = {
  get<T>(path: string, options: Omit<RequestOptions, "method"> = {}) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
};
