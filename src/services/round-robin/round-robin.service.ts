import { Inject, Injectable } from '@nestjs/common';
import { CepProvider } from '../../providers/base/cep.provider.js';
import { CEP_PROVIDERS } from '../../providers/base/cep.provider.config.js';

/**
 * Distributes requests between configured CEP providers using
 * the Round Robin strategy.
 */
@Injectable()
export class RoundRobinService {
  /** Index of the provider that will be selected next. */
  private currentIndex = 0;

  /**
   * Creates the Round Robin service.
   *
   * @param providers Configured CEP providers.
   */
  constructor(
    @Inject(CEP_PROVIDERS)
    private readonly providers: CepProvider[]
  ) {}

  /**
   * Returns the next provider in the Round Robin sequence.
   *
   * @returns The next configured provider.
   * @throws Error when no providers are configured.
   */
  getNextProvider(): CepProvider {
    if (!this.providers.length) {
      throw new Error('Providers List is empty.');
    }

    const provider = this.providers[this.currentIndex];

    this.currentIndex = (this.currentIndex + 1) % this.providers.length;

    return provider;
  }

  /**
   * Returns the number of configured providers.
   *
   * @returns The number of providers.
   * @throws Error when no providers are configured.
   */
  getProviderCount(): number {
    if (!this.providers.length) {
      throw new Error('Providers List is empty.');
    }

    return this.providers.length;
  }

  /**
   * Returns all configured providers without changing the Round Robin state.
   *
   * @returns A read-only view of the configured providers.
   */
  getProviders(): readonly CepProvider[] {
    return this.providers;
  }
}