// Analytics validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Analytics validation schemas
 */
export class AnalyticsValidationSchemas {
  /**
   * Schema for progress analytics request
   */
  static progressAnalyticsRequest(): ValidationSchema {
    return {
      required: [],
      rules: [
        {
          field: 'timeframe',
          validate: ValidationRules.custom((value: string) => {
            const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
            if (value && !validTimeframes.includes(value)) {
              return {
                isValid: false,
                error: `timeframe must be one of: ${validTimeframes.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'startDate', validate: ValidationRules.isoDate() },
        { field: 'endDate', validate: ValidationRules.isoDate() },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        {
          field: 'topics',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const topics = value.split(',');
            if (topics.length > 20) {
              return { isValid: false, error: 'Maximum 20 topics allowed' };
            }
            for (const topic of topics) {
              if (!/^[a-zA-Z0-9_-]+$/.test(topic.trim())) {
                return {
                  isValid: false,
                  error:
                    'Invalid topic format. Use alphanumeric characters, hyphens, and underscores only',
                };
              }
            }
            return { isValid: true };
          }),
        },
        { field: 'limit', validate: ValidationRules.numberRange(1, 1000) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }
}