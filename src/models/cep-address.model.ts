/**
 * Represents the formatted address returned by a CEP provider.
 */
export interface CepAddress {
  /** The postal code. */
  cep: string;

  /** The state abbreviation. */
  state: string;

  /** The city where the address is located. */
  city: string;

  /** The neighborhood of the address. */
  neighborhood: string;

  /** The street name of the address. */
  street: string;
}