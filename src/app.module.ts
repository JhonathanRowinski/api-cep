import { Module } from '@nestjs/common';
import { CepController } from './controllers/cep.controller.js';
import { CircuitBreakerService } from './infra/circuit-breaker/circuit-breaker.service.js';
import { HttpService } from './infra/http/http.service.js';
import { BrasilApiProvider } from './providers/brasilapi.provider.js';
import { ViacepProvider } from './providers/viacep.provider.js';
import { CepService } from './services/cep/cep.service.js';
import { RoundRobinService } from './services/round-robin/round-robin.service.js';
import { CEP_PROVIDERS_CONFIG } from './providers/base/cep.provider.config.js';

/**
 * Root application module.
 *
 * Registers the HTTP layer, CEP providers, provider selection,
 * circuit breaker, service and controller required by the API.
 */
@Module({
  controllers: [CepController],
  providers: [
    HttpService,
    ViacepProvider,
    BrasilApiProvider,
    CEP_PROVIDERS_CONFIG,
    RoundRobinService,
    CircuitBreakerService,
    CepService
  ]
})
export class AppModule {}