import { Injectable } from '@nestjs/common';
import { HttpService } from '../infra/http/http.service.js';
import { CepAddress } from '../models/cep-address.model.js';
import { CepProvider } from './base/cep.provider.js';

/**
 * Represents the response returned by the BrasilAPI CEP endpoint.
 */
interface BrasilApiResponse {
  /** The CEP returned by BrasilAPI. */
  cep: string;

  /** The state abbreviation. */
  state: string;

  /** The city name. */
  city: string;

  /** The neighborhood name. */
  neighborhood: string;

  /** The street name. */
  street: string;
}

/**
 * CEP provider implementation based on the BrasilAPI service.
 */
@Injectable()
export class BrasilApiProvider implements CepProvider {
  /** Provider display name. */
  readonly name = 'BrasilAPI';

  /** Base URL used by the BrasilAPI service. */
  readonly baseUrl = 'https://brasilapi.com.br/api/cep/v1';

  /** Maximum time allowed for requests made to BrasilAPI. */
  readonly timeoutMs = 2000;

  /**
   * Creates the BrasilAPI provider.
   *
   * @param httpService Service responsible for HTTP requests.
   */
  constructor(private readonly httpService: HttpService) {}

  /**
   * Retrieves an address from BrasilAPI and formats its response.
   *
   * @param cep The CEP to query.
   * @returns The formatted address.
   */
  async getAddress(cep: string): Promise<CepAddress> {
    const data = await this.httpService.get<BrasilApiResponse>(`${this.baseUrl}/${cep}`, this.timeoutMs);

    return {
      cep: data.cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      street: data.street
    };
  }
}