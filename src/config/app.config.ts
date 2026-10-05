/**
 * Centralizes application configuration values.
 */
export const APP_CONFIG = {
  http: {
    defaultTimeoutMs: 10000
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 120000
  }
} as const;