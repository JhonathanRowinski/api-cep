import { jest } from '@jest/globals';

import { CepAddress } from '../../models/cep-address.model.js';
import { CepProvider } from '../../providers/base/cep.provider.js';
import { RoundRobinService } from './round-robin.service.js';

describe('RoundRobinService', () => {
  const addressA: CepAddress = {
    cep: '80010000',
    state: 'PR',
    city: 'Curitiba',
    neighborhood: 'Centro',
    street: 'Rua XV de Novembro',
  };

  const addressB: CepAddress = {
    cep: '80020000',
    state: 'PR',
    city: 'Curitiba',
    neighborhood: 'Centro',
    street: 'Rua Voluntário da Pátria',
  };

  const createProviderA = (): CepProvider => ({
    name: 'Provider A',
    baseUrl: 'https://provider-a.com',
    getAddress: jest
      .fn<() => Promise<CepAddress>>()
      .mockResolvedValue(addressA),
  });

  const createProviderB = (): CepProvider => ({
    name: 'Provider B',
    baseUrl: 'https://provider-b.com',
    getAddress: jest
      .fn<() => Promise<CepAddress>>()
      .mockResolvedValue(addressB),
  });

  it('should return providers in sequence', () => {
    const providerA = createProviderA();
    const providerB = createProviderB();

    const service = new RoundRobinService([
      providerA,
      providerB,
    ]);

    expect(service.getNextProvider()).toBe(providerA);
    expect(service.getNextProvider()).toBe(providerB);
  });

  it('should restart from the first provider after reaching the end', () => {
    const providerA = createProviderA();
    const providerB = createProviderB();

    const service = new RoundRobinService([
      providerA,
      providerB,
    ]);

    expect(service.getNextProvider()).toBe(providerA);
    expect(service.getNextProvider()).toBe(providerB);
    expect(service.getNextProvider()).toBe(providerA);
  });

  it('should return the correct number of providers', () => {
    const providerA = createProviderA();
    const providerB = createProviderB();

    const service = new RoundRobinService([
      providerA,
      providerB,
    ]);

    expect(service.getProviderCount()).toBe(2);
  });

  it('should return all providers without changing the round robin state', () => {
    const providerA = createProviderA();
    const providerB = createProviderB();

    const service = new RoundRobinService([
      providerA,
      providerB,
    ]);

    expect(service.getProviders()).toEqual([
      providerA,
      providerB,
    ]);

    expect(service.getNextProvider()).toBe(providerA);
  });

  it('should throw an error when there are no providers', () => {
    const service = new RoundRobinService([]);

    expect(() => service.getNextProvider())
    .toThrow('Providers List is empty.');

    expect(() => service.getProviderCount())
    .toThrow('Providers List is empty.');
  });
});