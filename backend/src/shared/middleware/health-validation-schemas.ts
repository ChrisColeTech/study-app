// Health check validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Health check validation schemas
 */
export class HealthValidationSchemas {
  /**
   * Schema for detailed health check query parameters
   */
  static healthQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'includeDatabase', validate: ValidationRules.boolean() },
        { field: 'includeStorage', validate: ValidationRules.boolean() },
        { field: 'includeCache', validate: ValidationRules.boolean() },
        { field: 'includeExternal', validate: ValidationRules.boolean() },
        { field: 'timeout', validate: ValidationRules.numberRange(1000, 30000) },
      ],
    };
  }
}