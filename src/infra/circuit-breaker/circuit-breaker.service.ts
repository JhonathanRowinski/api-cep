import { Injectable } from '@nestjs/common';
import { CepProvider } from '../../providers/base/cep.provider.js';
import { CircuitBreaker } from './circuit-breaker.js';

/**
 * Manages the circuit breaker associated with each CEP provider.
 */
@Injectable()
export class CircuitBreakerService {
  /** Stores one circuit breaker instance for each provider. */
  private readonly breakers = new Map<CepProvider, CircuitBreaker>();

  /**
   * Retrieves the circuit breaker associated with a provider.
   *
   * A new circuit breaker is created when the provider does not
   * have one registered yet.
   *
   * @param provider Provider whose circuit breaker should be retrieved.
   * @returns The circuit breaker associated with the provider.
   */
  getBreaker(provider: CepProvider): CircuitBreaker {
    let breaker = this.breakers.get(provider);

    if (!breaker) {
      breaker = new CircuitBreaker();
      this.breakers.set(provider, breaker);
    }

    return breaker;
  }
}