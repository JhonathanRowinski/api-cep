import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { CepAddress } from '../../models/cep-address.model.js';
import { CepProvider } from '../../providers/base/cep.provider.js';
import { CircuitBreakerService } from '../../infra/circuit-breaker/circuit-breaker.service.js';
import { CepService } from './cep.service.js';
import { RoundRobinService } from '../round-robin/round-robin.service.js';

describe('CepService', () => {
  const addressA: CepAddress = {
    cep: '80010000',
    state: 'PR',
    city: 'Curitiba',
    neighborhood: 'Centro',
    street: 'Rua A'
  };

  const addressB: CepAddress = {
    cep: '80020000',
    state: 'PR',
    city: 'Curitiba',
    neighborhood: 'Centro',
    street: 'Rua B'
  };

  const createProvider = (
    name: string,
    address: CepAddress
  ): CepProvider => ({
    name,
    baseUrl: `https://${name.toLowerCase().replace(' ', '-')}.com`,
    getAddress: jest
      .fn<() => Promise<CepAddress>>()
      .mockResolvedValue(address)
  });

  const createService = (providers: CepProvider[]) => {
    const roundRobinService = new RoundRobinService(providers);
    const circuitBreakerService = new CircuitBreakerService();
    const service = new CepService(
      roundRobinService,
      circuitBreakerService
    );

    return {
      service,
      roundRobinService,
      circuitBreakerService
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return the address when the first provider succeeds', async () => {
    const providerA = createProvider('Provider A', addressA);
    const { service } = createService([providerA]);

    await expect(service.getAddress(addressA.cep)).resolves.toEqual(addressA);

    expect(providerA.getAddress).toHaveBeenCalledWith(addressA.cep);
    expect(providerA.getAddress).toHaveBeenCalledTimes(1);
  });

  it('should fallback to the next provider when the first provider fails', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    jest
      .spyOn(providerA, 'getAddress')
      .mockRejectedValue(new Error('Provider A failed'));

    const { service } = createService([providerA, providerB]);

    await expect(service.getAddress(addressA.cep)).resolves.toEqual(addressB);

    expect(providerA.getAddress).toHaveBeenCalledWith(addressA.cep);
    expect(providerB.getAddress).toHaveBeenCalledWith(addressA.cep);
  });

  it('should throw ServiceUnavailableException when all providers fail', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    jest
      .spyOn(providerA, 'getAddress')
      .mockRejectedValue(new Error('Provider A failed'));

    jest
      .spyOn(providerB, 'getAddress')
      .mockRejectedValue(new Error('Provider B failed'));

    const { service } = createService([providerA, providerB]);

    await expect(service.getAddress(addressA.cep)).rejects.toThrow(
      new ServiceUnavailableException(
        'Unable to retrieve address with available providers.'
      )
    );

    expect(providerA.getAddress).toHaveBeenCalledWith(addressA.cep);
    expect(providerB.getAddress).toHaveBeenCalledWith(addressA.cep);
  });

  it('should use providers in Round Robin order', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { service } = createService([providerA, providerB]);

    await service.getAddress(addressA.cep);
    await service.getAddress(addressA.cep);
    await service.getAddress(addressA.cep);
    await service.getAddress(addressA.cep);

    expect(providerA.getAddress).toHaveBeenCalledTimes(2);
    expect(providerB.getAddress).toHaveBeenCalledTimes(2);

    expect(providerA.getAddress).toHaveBeenNthCalledWith(1, addressA.cep);
    expect(providerB.getAddress).toHaveBeenNthCalledWith(1, addressA.cep);
    expect(providerA.getAddress).toHaveBeenNthCalledWith(2, addressA.cep);
    expect(providerB.getAddress).toHaveBeenNthCalledWith(2, addressA.cep);
  });

  it('should skip a provider when its circuit is OPEN', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { service, circuitBreakerService } = createService([
      providerA,
      providerB
    ]);

    const breakerA = circuitBreakerService.getBreaker(providerA);

    jest
      .spyOn(breakerA, 'canExecute')
      .mockReturnValue(false);

    const executeSpy = jest.spyOn(breakerA, 'execute');

    await expect(service.getAddress(addressA.cep)).resolves.toEqual(addressB);

    expect(executeSpy).not.toHaveBeenCalled();
    expect(providerA.getAddress).not.toHaveBeenCalled();
    expect(providerB.getAddress).toHaveBeenCalledWith(addressA.cep);
  });

  it('should not call any provider when all circuits are OPEN', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { service, circuitBreakerService } = createService([
      providerA,
      providerB
    ]);

    const breakerA = circuitBreakerService.getBreaker(providerA);
    const breakerB = circuitBreakerService.getBreaker(providerB);

    jest.spyOn(breakerA, 'canExecute').mockReturnValue(false);
    jest.spyOn(breakerB, 'canExecute').mockReturnValue(false);

    await expect(service.getAddress(addressA.cep)).rejects.toThrow(
      new ServiceUnavailableException(
        'No providers are currently available.'
      )
    );

    expect(providerA.getAddress).not.toHaveBeenCalled();
    expect(providerB.getAddress).not.toHaveBeenCalled();
  });

  it('should use a separate circuit breaker for each provider', () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { circuitBreakerService } = createService([
      providerA,
      providerB
    ]);

    const breakerA = circuitBreakerService.getBreaker(providerA);
    const breakerB = circuitBreakerService.getBreaker(providerB);

    expect(breakerA).not.toBe(breakerB);
  });

  it('should log when trying a provider', async () => {
    const providerA = createProvider('Provider A', addressA);
    const { service } = createService([providerA]);

    const logSpy = jest.spyOn(
      service['logger'],
      'log'
    );

    await service.getAddress(addressA.cep);

    expect(logSpy).toHaveBeenCalledWith(
      `Trying provider Provider A for CEP ${addressA.cep}.`
    );
  });

  it('should log when a provider succeeds', async () => {
    const providerA = createProvider('Provider A', addressA);
    const { service } = createService([providerA]);

    const logSpy = jest.spyOn(
      service['logger'],
      'log'
    );

    await service.getAddress(addressA.cep);

    expect(logSpy).toHaveBeenCalledWith(
      `Provider Provider A successfully returned the CEP ${addressA.cep}.`
    );
  });

  it('should log when a provider fails', async () => {
    const providerA = createProvider('Provider A', addressA);

    jest
      .spyOn(providerA, 'getAddress')
      .mockRejectedValue(new Error('Provider error'));

    const { service } = createService([providerA]);

    const warnSpy = jest.spyOn(
      service['logger'],
      'warn'
    );

    await expect(service.getAddress(addressA.cep)).rejects.toThrow(
      ServiceUnavailableException
    );

    expect(warnSpy).toHaveBeenCalledWith(
      `Provider Provider A failed for CEP ${addressA.cep}: Provider error`
    );
  });

  it('should log when falling back to the next provider', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    jest
      .spyOn(providerA, 'getAddress')
      .mockRejectedValue(new Error('Provider A failed'));

    const { service } = createService([providerA, providerB]);

    const warnSpy = jest.spyOn(
      service['logger'],
      'warn'
    );

    await service.getAddress(addressA.cep);

    expect(warnSpy).toHaveBeenCalledWith(
      'Falling back to the next provider.'
    );
  });

  it('should log when a provider is skipped because its circuit is OPEN', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { service, circuitBreakerService } = createService([
      providerA,
      providerB
    ]);

    const breakerA = circuitBreakerService.getBreaker(providerA);

    jest
      .spyOn(breakerA, 'canExecute')
      .mockReturnValue(false);

    const warnSpy = jest.spyOn(
      service['logger'],
      'warn'
    );

    await service.getAddress(addressA.cep);

    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping provider Provider A because its circuit is OPEN.'
    );
  });

  it('should log when all providers fail', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    jest
      .spyOn(providerA, 'getAddress')
      .mockRejectedValue(new Error('Provider A failed'));

    jest
      .spyOn(providerB, 'getAddress')
      .mockRejectedValue(new Error('Provider B failed'));

    const { service } = createService([providerA, providerB]);

    const errorSpy = jest.spyOn(
      service['logger'],
      'error'
    );

    await expect(service.getAddress(addressA.cep)).rejects.toThrow(
      ServiceUnavailableException
    );

    expect(errorSpy).toHaveBeenCalledWith(
      `All providers failed for CEP ${addressA.cep}.`
    );
  });

  it('should log when no providers are available', async () => {
    const providerA = createProvider('Provider A', addressA);
    const providerB = createProvider('Provider B', addressB);

    const { service, circuitBreakerService } = createService([
      providerA,
      providerB
    ]);

    jest
      .spyOn(
        circuitBreakerService.getBreaker(providerA),
        'canExecute'
      )
      .mockReturnValue(false);

    jest
      .spyOn(
        circuitBreakerService.getBreaker(providerB),
        'canExecute'
      )
      .mockReturnValue(false);

    const errorSpy = jest.spyOn(
      service['logger'],
      'error'
    );

    await expect(service.getAddress(addressA.cep)).rejects.toThrow(
      new ServiceUnavailableException(
        'No providers are currently available.'
      )
    );

    expect(errorSpy).toHaveBeenCalledWith(
      `No providers available for CEP ${addressA.cep}.`
    );
  });
});