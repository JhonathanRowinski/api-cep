import { BadRequestException, PipeTransform } from '@nestjs/common';

/**
 * Validate CEP value received by the API.
 *
 * Accepted formats are XXXXXXXX and XXXXX-XXX.
 * The returned value is always formatted to XXXXXXXX.
 */
export class CepValidationPipe implements PipeTransform {
  /**
   * Validates and formats a CEP.
   *
   * @param value CEP value received from the request.
   * @returns The CEP without formatting characters.
   * @throws BadRequestException when the CEP format is invalid.
   */
  transform(value: string): string {
    if (!/^\d{5}-?\d{3}$/.test(value)) {
      throw new BadRequestException('CEP inválido');
    }

    return value.replace('-', '');
  }
}