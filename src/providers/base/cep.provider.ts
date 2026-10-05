import { CepAddress } from '../../models/cep-address.model.js';

/**
 * Defines the contract implemented by CEP providers.
 *
 * Providers are responsible for communicating with an external
 * CEP service and converting its response into the CepAddress format.
 * {@link CepAddress} format.
 */
export interface CepProvider {
  /** The provider name used for identification and logging. */
  name: string;

  /** The base URL used by the provider API. */
  baseUrl: string;

  /** 
   * The provider-specific request timeout in milliseconds.
   * Optional field.
   */
  timeoutMs?: number;

  /**
   * Retrieves an address from the provider.
   *
   * @param cep The CEP to query.
   * @returns A formatted address.
   */
  getAddress(cep: string): Promise<CepAddress>;
}