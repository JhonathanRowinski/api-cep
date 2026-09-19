import { Injectable } from '@nestjs/common';
import { HttpService } from '../infra/http/http.service.js';
import { CepAddress } from '../models/cep-address.model.js';
import { CepProvider } from './base/cep.provider.js';

/**
 * Represents the response returned by the ViaCEP API.
 */
interface ViaCepResponse {
  /** The CEP returned by ViaCEP. */
  cep: string;

  /** The state abbreviation. */
  uf: string;

  /** The city name. */
  localidade: string;

  /** The neighborhood name. */
  bairro: string;

  /** The street name. */
  logradouro: string;
}

/**
 * CEP provider implementation based on the ViaCEP API.
 */
@Injectable()
export class ViacepProvider implements CepProvider {
  /** Provider display name. */
  readonly name = 'ViaCEP';

  /** Base URL used by the ViaCEP API. */
  readonly baseUrl = 'https://viacep.com.br/ws';

  /**
   * Creates the ViaCEP provider.
   *
   * @param httpService Service responsible for HTTP requests.
   */
  constructor(private readonly httpService: HttpService) {}

  /**
   * Retrieves an address from ViaCEP and formats its response.
   *
   * @param cep The CEP to query.
   * @returns The formatted address.
   */
  async getAddress(cep: string): Promise<CepAddress> {
    const data = await this.httpService.get<ViaCepResponse>(`${this.baseUrl}/${cep}/json/`);

    return {
      cep: data.cep,
      state: data.uf,
      city: data.localidade,
      neighborhood: data.bairro,
      street: data.logradouro
    };
  }
}