// Exam validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Exam validation schemas
 */
export class ExamValidationSchemas {
  /**
   * Schema for exam ID validation
   */
  static examId(): ValidationSchema {
    return {
      required: ['examId'],
      rules: [{ field: 'examId', validate: ValidationRules.alphanumericId() }],
    };
  }

  /**
   * Schema for exam query parameters
   */
  static examQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'includeTopics', validate: ValidationRules.boolean() },
        { field: 'includeQuestionCount', validate: ValidationRules.boolean() },
        {
          field: 'difficulty',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validDifficulties = ['beginner', 'intermediate', 'advanced'];
            if (!validDifficulties.includes(value)) {
              return {
                isValid: false,
                error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }
}