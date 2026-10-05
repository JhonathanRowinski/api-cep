import { Logger } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app.config.js';

/**
 * Represents the possible states of a circuit breaker.
 *
 * CLOSED:
 * The provider is considered available and requests are allowed.
 * Consecutive failures are counted while the circuit remains closed.
 *
 * OPEN:
 * The provider has reached the failure threshold and requests are blocked.
 * Requests remain blocked until the reset timeout has elapsed.
 *
 * HALF_OPEN:
 * The reset timeout has elapsed and the circuit allows a single recovery
 * request to test whether the provider is available again.
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Prevents repeated requests to an unhealthy external provider.
 *
 * The circuit starts in CLOSED state, opens after a configured
 * number of consecutive failures, and allows a recovery request
 * after the configured reset timeout.
 */
export class CircuitBreaker {
  /** Logger used to record circuit state transitions and rejected requests. */
  private readonly logger = new Logger(CircuitBreaker.name);

  /** Current circuit state. */
  private state: CircuitState = 'CLOSED';

  /** Number of consecutive failures in the current closed cycle. */
  private failureCount = 0;

  /** Timestamp when the circuit entered OPEN state. */
  private openedAt?: number;

  /**
   * Indicates whether a HALF_OPEN recovery request is currently running.
   *
   * When the circuit transitions from OPEN to HALF_OPEN, a single request
   * is allowed to test whether the provider has recovered. While this
   * recovery request is in progress, additional requests are rejected to
   * prevent multiple recovery attempts from running concurrently.
   */
  private halfOpenRequestInProgress = false;

  /**
   * Creates a circuit breaker.
   *
   * @param failureThreshold Number of consecutive failures required to open the circuit.
   * @param resetTimeoutMs Time in milliseconds before an OPEN circuit can attempt recovery.
   */
  constructor(
    private readonly failureThreshold: number = APP_CONFIG.circuitBreaker.failureThreshold,
    private readonly resetTimeoutMs: number = APP_CONFIG.circuitBreaker.resetTimeoutMs
  ) {}

  /**
   * Determines whether an operation is currently allowed.
   *
   * @returns True when the circuit allows an operation.
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt!;

      return elapsed >= this.resetTimeoutMs;
    }

    return !this.halfOpenRequestInProgress;
  }

  /**
   * Executes an operation through the circuit breaker.
   *
   * @param operation Asynchronous operation protected by the circuit breaker.
   * @returns The result returned by the operation.
   * @throws Error when the circuit does not allow execution or the operation fails.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.checkState();

    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenRequestInProgress = true;
      }

      const result = await operation();

      this.onSuccess();

      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Validates the current circuit state before an operation executes.
   *
   * Transitions an OPEN circuit to HALF_OPEN when the reset timeout
   * has elapsed and rejects operations while the circuit remains open.
   *
   * @throws Error when the circuit does not allow execution.
   */
  private checkState(): void {
    switch (this.state) {
      case 'CLOSED':
        return;

      case 'OPEN': {
        const elapsed = Date.now() - this.openedAt!;

        if (elapsed < this.resetTimeoutMs) {
          this.logger.warn('Circuit Breaker rejected request because it is OPEN.');
          throw new Error('Circuit Breaker is Open.');
        }

        this.state = 'HALF_OPEN';
        this.failureCount = 0;

        this.logger.log('Circuit Breaker transitioned from OPEN to HALF_OPEN.');

        return;
      }

      case 'HALF_OPEN':
        if (this.halfOpenRequestInProgress) {
          this.logger.warn('Circuit Breaker rejected concurrent HALF_OPEN request.');
          throw new Error('Circuit Breaker is Open.');
        }

        return;
    }
  }

  /**
   * Handles a successful operation.
   *
   * A successful operation resets the failure counter and closes the circuit.
   */
  private onSuccess(): void {
    const previousState = this.state;

    this.failureCount = 0;
    this.state = 'CLOSED';
    this.openedAt = undefined;

    if (previousState === 'HALF_OPEN') {
      this.halfOpenRequestInProgress = false;

      this.logger.log('Circuit Breaker transitioned from HALF_OPEN to CLOSED.');
    }
  }

  /**
   * Handles a failed operation.
   *
   * Consecutive failures eventually open the circuit. A failed
   * recovery attempt from HALF_OPEN immediately reopens it.
   */
  private onFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.halfOpenRequestInProgress = false;

      this.logger.warn('Circuit Breaker Reopened after HALF_OPEN attempt failed.');

      return;
    }

    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();

      this.logger.warn(`Circuit Breaker Opened after ${this.failureCount} consecutive failures.`);
    }
  }
}