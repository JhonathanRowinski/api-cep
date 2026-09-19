import { BrasilApiProvider } from "../brasilapi.provider.js";
import { ViacepProvider } from "../viacep.provider.js";

/**
 * Injection token used to register the configured CEP providers.
 */
export const CEP_PROVIDERS = Symbol('CEP_PROVIDERS');

/**
 * NestJS provider configuration responsible for creating
 * the list of CEP providers used by the application.
 *
 * @param viacep The ViaCEP provider.
 * @param brasilapi The BrasilAPI provider.
 * @returns The configured CEP providers.
 */
export const CEP_PROVIDERS_CONFIG = {
  provide: CEP_PROVIDERS,
  useFactory: (
    viacep: ViacepProvider,
    brasilapi: BrasilApiProvider
  ) => [viacep, brasilapi],
  inject: [
    ViacepProvider,
    BrasilApiProvider
  ]
};