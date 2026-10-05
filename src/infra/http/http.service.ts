import { Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app.config.js';

/**
 * Provides a lightweight HTTP client abstraction based on
 * the native Fetch API.
 */
@Injectable()
export class HttpService {
  /** Default timeout applied when a request does not provide one. */
  private readonly defaultTimeoutMs = APP_CONFIG.http.defaultTimeoutMs;

  /** Unique reason used to identify requests aborted by the timeout. */
  private readonly timeoutReason = Symbol('HTTP_TIMEOUT');

  /**
   * Executes an HTTP GET request.
   *
   * @param url The URL to request.
   * @param timeoutMs Maximum request duration in milliseconds.
   * @returns The parsed response body.
   * @throws Error when the response is unsuccessful or the request times out.
   */
  async get<T>(url: string, timeoutMs: number = this.defaultTimeoutMs): Promise<T> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort(this.timeoutReason);
    }, timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Unknown Error'}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.reason === this.timeoutReason) {
        throw new Error(`HTTP request timed out after ${timeoutMs}ms.`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}