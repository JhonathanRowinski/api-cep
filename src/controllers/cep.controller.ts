import { Controller, Get, Param } from '@nestjs/common';
import { CepValidationPipe } from '../pipes/cep-validation.pipe.js';
import { CepService } from '../services/cep/cep.service.js';

/**
 * Exposes HTTP endpoints for CEP queries.
 */
@Controller('cep')
export class CepController {
  /**
   * Creates the CEP controller.
   *
   * @param cepService Service responsible for CEP lookups.
   */
  constructor(private readonly cepService: CepService) {}

  /**
   * Retrieves an address using the provided CEP.
   *
   * The CEP is validated before being passed to the application service.
   *
   * @param cep CEP received through the route parameter.
   * @returns The address associated with the CEP.
   */
  @Get(':cep')
  getCep(@Param('cep', CepValidationPipe) cep: string) {
    return this.cepService.getAddress(cep);
  }
}