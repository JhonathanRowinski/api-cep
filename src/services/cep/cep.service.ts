import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { CircuitBreakerService } from '../../infra/circuit-breaker/circuit-breaker.service.js';
import { CepAddress } from '../../models/cep-address.model.js';
import { RoundRobinService } from '../round-robin/round-robin.service.js';

/**
 * Coordinates CEP lookups using the configured providers.
 *
 * The service combines Round Robin distribution, circuit breaker
 * protection and fallback between providers.
 */
@Injectable()
export class CepService {
  /** Logger used to record provider execution and failure information. */
  private readonly logger = new Logger(CepService.name);

  /** Number of configured providers used to limit fallback attempts. */
  private readonly providerCount: number;

  /**
   * Creates the CEP service.
   *
   * @param roundRobinService Service responsible for provider selection.
   * @param circuitBreakerService Service responsible for provider circuit breakers.
   */
  constructor(
    private readonly roundRobinService: RoundRobinService,
    private readonly circuitBreakerService: CircuitBreakerService
  ) {
    this.providerCount = this.roundRobinService.getProviderCount();
  }

  /**
   * Retrieves an address for a CEP.
   *
   * The method first verifies whether at least one provider is currently
   * available. If available providers exist, it attempts providers according
   * to the Round Robin sequence and falls back when a provider fails.
   *
   * @param cep The CEP to query.
   * @returns The address associated with the CEP.
   * @throws ServiceUnavailableException when no provider is available
   * or all configured providers fail.
   */
  async getAddress(cep: string): Promise<CepAddress> {
    if (!this.hasAvailableProvider()) {
      this.logger.error(`No providers available for CEP ${cep}.`);

      throw new ServiceUnavailableException('No providers are currently available.');
    }

    for (let attempt = 0; attempt < this.providerCount; attempt++) {
      // Select the next provider in the Round Robin sequence.
      const provider = this.roundRobinService.getNextProvider();

      // Retrieve the circuit breaker for the selected provider.
      const breaker = this.circuitBreakerService.getBreaker(provider);

      // Check whether the provider's circuit is OPEN and skip it if so.
      if (!breaker.canExecute()) {
        this.logger.warn(`Skipping provider ${provider.name} because its circuit is OPEN.`);
        continue;
      }

      this.logger.log(`Trying provider ${provider.name} for CEP ${cep}.`);

      try {
        // Execute the provider's getAddress method within the circuit breaker.
        const address = await breaker.execute(() => provider.getAddress(cep));

        this.logger.log(`Provider ${provider.name} successfully returned the CEP ${cep}.`);

        return address;
      } catch (error) {
        // Log the provider failure and continue to the next provider.
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(`Provider ${provider.name} failed for CEP ${cep}: ${message}`);

        if (attempt < this.providerCount - 1) {
          this.logger.warn('Falling back to the next provider.');
        }
      }
    }

    // If all providers fail, log the failure and throw an exception.
    this.logger.error(`All providers failed for CEP ${cep}.`);

    throw new ServiceUnavailableException('Unable to retrieve address with available providers.');
  }

  /**
   * Determines whether at least one provider can currently execute a request.
   *
   * This method does not advance the Round Robin index.
   *
   * @returns True when at least one provider is available.
   */
  private hasAvailableProvider(): boolean {
    return this.roundRobinService.getProviders().some((provider) =>
      this.circuitBreakerService.getBreaker(provider).canExecute()
    );
  }
}