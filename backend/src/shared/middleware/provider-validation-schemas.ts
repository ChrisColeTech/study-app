// Provider validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Provider validation schemas
 */
export class ProviderValidationSchemas {
  /**
   * Schema for provider ID validation
   */
  static providerId(): ValidationSchema {
    return {
      required: ['providerId'],
      rules: [
        {
          field: 'providerId',
          validate: ValidationRules.custom((value: string) => {
            const validProviders = ['aws', 'azure', 'gcp', 'comptia', 'cisco'];
            if (!validProviders.includes(value.toLowerCase())) {
              return {
                isValid: false,
                error: `Invalid provider. Valid options: ${validProviders.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }

  /**
   * Schema for provider query parameters
   */
  static providerQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'includeExams', validate: ValidationRules.boolean() },
        { field: 'includeStats', validate: ValidationRules.boolean() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }
}